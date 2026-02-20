import { Injectable } from '@nestjs/common';
import { IFlightProvider } from '../providers/base.provider';
import { AmadeusProvider } from '../providers/amadeus.provider';
import { DemoProvider } from '../providers/demo.provider';
import { KiwiProvider } from '../providers/kiwi.provider';
import { FlightSearchParams, FlightSearchResult, NormalizedFlight, ProviderStatus } from '../common/types';
import { rankingEngine } from '../ranking/ranking.engine';
import { CacheService } from '../cache/cache.service';

/**
 * Flight Aggregator Service
 * Coordinates searches across multiple flight providers
 * Handles normalization, deduplication, and ranking
 */
@Injectable()
export class FlightAggregatorService {
  private providers: Map<string, IFlightProvider> = new Map();

  constructor(private cacheService: CacheService) {
    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   */
  private initializeProviders(): void {
    const amadeusKey = process.env.AMADEUS_API_KEY;
    const amadeusSecret = process.env.AMADEUS_API_SECRET;
    const kiwiKey = process.env.KIWI_API_KEY;

    console.log('[INIT] AMADEUS_API_KEY present:', !!amadeusKey, amadeusKey ? `(length: ${amadeusKey.length})` : '');
    console.log('[INIT] AMADEUS_API_SECRET present:', !!amadeusSecret, amadeusSecret ? `(length: ${amadeusSecret.length})` : '');
    console.log('[INIT] KIWI_API_KEY present:', !!kiwiKey);

    // Use demo provider for testing (no real API keys needed)
    console.log('[INIT] Registering Demo provider for testing...');
    this.registerProvider(new DemoProvider());

    // Uncomment below to use real Amadeus when keys are available
    // if (amadeusKey && amadeusSecret) {
    //   console.log('[INIT] Registering Amadeus provider...');
    //   this.registerProvider(new AmadeusProvider(amadeusKey, amadeusSecret));
    // } else {
    //   console.log('[INIT] ❌ Amadeus keys missing! Key:', !!amadeusKey, 'Secret:', !!amadeusSecret);
    // }

    // Kiwi provider temporarily disabled
    // if (kiwiKey) {
    //   this.registerProvider(new KiwiProvider(kiwiKey));
    // }

    console.log(`[INIT] Initialized ${this.providers.size} flight providers`);
    console.log('[INIT] Available providers:', Array.from(this.providers.keys()));
  }

  /**
   * Register a new provider
   */
  registerProvider(provider: IFlightProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get all registered providers
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Search for flights across all providers
   */
  async searchFlights(params: FlightSearchParams): Promise<FlightSearchResult> {
    const startTime = Date.now();

    console.log('[AGGREGATOR] Incoming search request:', JSON.stringify(params, null, 2));

    // Check cache first
    const cacheKey = this.generateCacheKey(params);
    const cachedResult = await this.cacheService.get<FlightSearchResult>(cacheKey);

    if (cachedResult) {
      console.log('[AGGREGATOR] Cache hit for key:', cacheKey);
      return {
        ...JSON.parse(JSON.stringify(cachedResult)),
        cacheHit: true,
      } as FlightSearchResult;
    }

    // Determine which providers to query
    const providersToQuery = this.selectProviders(params);

    console.log('[AGGREGATOR] Selected providers to query:', providersToQuery);

    if (providersToQuery.length === 0) {
      console.log('[AGGREGATOR] No providers available to query');
      return {
        status: 'error',
        query: params,
        flights: [],
        totalResults: 0,
        providersQueried: [],
        timestamp: new Date().toISOString(),
        cacheHit: false,
      };
    }

    // Query all providers in parallel
    const results = await Promise.allSettled(
      providersToQuery.map((providerName) => this.queryProvider(providerName, params)),
    );

    // Process results
    const aggregatedFlights: NormalizedFlight[] = [];
    const providerStatuses: ProviderStatus[] = [];

    results.forEach((result, index) => {
      const providerName = providersToQuery[index];
      const resultTime = Date.now() - startTime;

      if (result.status === 'fulfilled') {
        const { flights, error } = result.value;

        if (flights.length > 0) {
          aggregatedFlights.push(...flights);
        }

        providerStatuses.push({
          name: providerName,
          status: error ? 'error' : 'success',
          resultsCount: flights.length,
          error,
          responseTime: resultTime,
        });
      } else {
        providerStatuses.push({
          name: providerName,
          status: 'error',
          resultsCount: 0,
          error: result.reason?.message || 'Unknown error',
          responseTime: resultTime,
        });
      }
    });

    // Deduplicate flights by important fields
    const deduplicatedFlights = this.deduplicateFlights(aggregatedFlights);

    // Rank flights
    const rankedFlights = rankingEngine.rankFlights(deduplicatedFlights);

    // Determine overall status
    const allSuccess = providerStatuses.every((s) => s.status === 'success');
    const status = allSuccess ? 'success' : providerStatuses.some((s) => s.status === 'success') ? 'partial' : 'error';

    const searchResult: FlightSearchResult = {
      status: status as 'success' | 'partial' | 'error',
      query: params,
      flights: rankedFlights,
      totalResults: rankedFlights.length,
      providersQueried: providerStatuses,
      timestamp: new Date().toISOString(),
      cacheHit: false,
    };

    // Cache the result (without cacheHit flag for storage)
    const cacheData = { ...searchResult, cacheHit: false };
    await this.cacheService.set(cacheKey, cacheData, 600); // Cache for 10 minutes

    return searchResult;
  }

  /**
   * Query a specific provider
   */
  private async queryProvider(
    providerName: string,
    params: FlightSearchParams,
  ): Promise<{ flights: NormalizedFlight[]; error?: string }> {
    const provider = this.providers.get(providerName);

    if (!provider) {
      return {
        flights: [],
        error: `Provider ${providerName} not found`,
      };
    }

    if (!provider.canHandle(params)) {
      return {
        flights: [],
        error: `Provider ${providerName} cannot handle this search`,
      };
    }

    try {
      const flights = await provider.search(params);
      return { flights };
    } catch (error) {
      console.error(`Error querying provider ${providerName}:`, error);
      return {
        flights: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Select which providers to query
   */
  private selectProviders(params: FlightSearchParams): string[] {
    if (params.includeProviders && params.includeProviders.length > 0) {
      // User specified providers
      return params.includeProviders.filter((p) => this.providers.has(p));
    }

    // Return all available providers
    return Array.from(this.providers.keys());
  }

  /**
   * Deduplicate flights from different providers
   * Flights are considered duplicates if they have:
   * - Same departure and arrival times (within 5 minutes)
   * - Same airline
   * - Similar price (within 2%)
   */
  private deduplicateFlights(flights: NormalizedFlight[]): NormalizedFlight[] {
    const seen = new Set<string>();
    const deduped: NormalizedFlight[] = [];

    // Sort by ranking score (if available) to keep better results
    const sorted = [...flights].sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));

    for (const flight of sorted) {
      const signature = this.getFlightSignature(flight);

      if (!seen.has(signature)) {
        seen.add(signature);
        deduped.push(flight);
      }
    }

    return deduped;
  }

  /**
   * Generate a signature for a flight to detect duplicates
   */
  private getFlightSignature(flight: NormalizedFlight): string {
    // Create a signature based on key flight attributes
    // This is a simple approach; production might use more sophisticated matching
    const depTime = new Date(flight.departureTime);
    const arrTime = new Date(flight.arrivalTime);

    return `${flight.departureAirport}_${flight.arrivalAirport}_${flight.airlineCode}_${depTime.getHours()}_${arrTime.getHours()}_${Math.round(flight.price / 10)}_${flight.stops}`;
  }

  /**
   * Generate a cache key for search parameters
   */
  private generateCacheKey(params: FlightSearchParams): string {
    return `flight_search:${params.from}:${params.to}:${params.departDate}:${params.returnDate || 'oneway'}:${params.passengers}:${params.tripType}`;
  }

  /**
   * Validate search parameters
   */
  validateSearchParams(params: FlightSearchParams): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.from || params.from.length !== 3) {
      errors.push('Invalid departure airport code');
    }

    if (!params.to || params.to.length !== 3) {
      errors.push('Invalid arrival airport code');
    }

    if (!params.departDate) {
      errors.push('Departure date is required');
    } else if (new Date(params.departDate) < new Date()) {
      errors.push('Departure date cannot be in the past');
    }

    if (params.tripType === 'round-trip' && !params.returnDate) {
      errors.push('Return date is required for round-trip');
    }

    if (params.tripType === 'round-trip' && params.returnDate) {
      if (new Date(params.returnDate) <= new Date(params.departDate)) {
        errors.push('Return date must be after departure date');
      }
    }

    if (!params.passengers || params.passengers < 1 || params.passengers > 9) {
      errors.push('Number of passengers must be between 1 and 9');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
