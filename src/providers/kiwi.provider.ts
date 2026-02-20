import axios, { Axios } from 'axios';
import { BaseFlightProvider } from './base.provider';
import { FlightSearchParams, NormalizedFlight } from '../common/types';

/**
 * Kiwi.com API Provider Implementation
 * Used both for search and as primary affiliate/redirect endpoint
 * Reference: https://docs.kiwi.com/
 */
export class KiwiProvider extends BaseFlightProvider {
  name = 'kiwi';
  protected baseUrl = 'https://api.kiwi.com/v2';
  private httpClient: Axios;

  constructor(apiKey: string) {
    super(apiKey);
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'apikey': apiKey,
      },
    });
  }

  async search(params: FlightSearchParams): Promise<NormalizedFlight[]> {
    try {
      const kiwiParams = this.buildSearchParams(params);

      const response = await this.httpClient.get('/search', {
        params: kiwiParams,
      });

      if (!response.data.data || response.data.data.length === 0) {
        return [];
      }

      return response.data.data.map((flight: any) =>
        this.normalize(flight, params),
      );
    } catch (error) {
      console.error(`Kiwi provider error: ${error}`);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  canHandle(params: FlightSearchParams): boolean {
    // Kiwi supports most routes globally
    return true;
  }

  /**
   * Build Kiwi-specific query parameters
   */
  private buildSearchParams(params: FlightSearchParams): Record<string, any> {
    const searchParams: Record<string, any> = {
      fly_from: params.from,
      fly_to: params.to,
      date_from: params.departDate,
      date_to: params.departDate, // Kiwi requires date range
      adults: params.passengers,
      limit: 50,
      sort: 'price', // Sort by price
      asc: 1, // Ascending order (cheapest first)
      v: 3, // API version
    };

    if (params.tripType === 'round-trip' && params.returnDate) {
      searchParams.return_from = params.returnDate;
      searchParams.return_to = params.returnDate;
    }

    if (params.maxPrice) {
      searchParams.price_to = params.maxPrice;
    }

    if (params.cabin === 'business') {
      searchParams.seat_class = 'business';
    }

    return searchParams;
  }

  /**
   * Normalize Kiwi response to our standard format
   * Kiwi returns flights with route segments
   */
  protected normalize(rawFlight: any, params: FlightSearchParams): NormalizedFlight {
    // Kiwi returns routes which contain multiple flight segments
    const routes = rawFlight.route || [];
    const firstRoute = routes[0];
    const lastRoute = routes[routes.length - 1];

    const departureTime = new Date(firstRoute.local_departure * 1000).toISOString();
    const arrivalTime = new Date(lastRoute.local_arrival * 1000).toISOString();

    // Calculate stops (number of segments - 1)
    const stops = routes.length - 1;

    // Duration in minutes
    const duration = Math.round((lastRoute.local_arrival - firstRoute.local_departure) / 60);

    // Deep link for booking (this is Kiwi's native booking)
    const bookingUrl = `https://www.kiwi.com/us/search/results/${params.from}/${params.to}/${params.departDate}${params.returnDate ? '/' + params.returnDate : ''}?passengers=${params.passengers}&affiliateId=${process.env.KIWI_AFFILIATE_ID || 'findmyflight'}&flightId=${rawFlight.id}`;

    return {
      id: `kiwi_${rawFlight.id}`,
      provider: this.name,
      airline: this.getAirlineName(firstRoute.airline),
      airlineCode: firstRoute.airline,
      departureTime: departureTime,
      arrivalTime: arrivalTime,
      duration: duration,
      stops: stops,
      stopDetails: this.buildStopDetails(routes),
      price: rawFlight.price,
      currency: rawFlight.currency || 'USD',
      bookingUrl: bookingUrl,
      tripType: params.tripType,
      departureAirport: params.from,
      arrivalAirport: params.to,
      departureDate: params.departDate,
      returnDate: params.returnDate,
    };
  }

  /**
   * Build stop details from route segments
   */
  private buildStopDetails(routes: any[]) {
    // Skip first segment, map rest to stops
    return routes.slice(1).map((route, index) => {
      const prevRoute = routes[index];
      // Duration in minutes
      const duration = Math.round((route.local_departure - prevRoute.local_arrival) / 60);

      return {
        airport: route.flyFrom,
        duration: duration,
      };
    });
  }

  /**
   * Get human-readable airline name
   */
  private getAirlineName(carrierCode: string): string {
    const airlineMap: Record<string, string> = {
      AA: 'American Airlines',
      UA: 'United Airlines',
      DL: 'Delta Air Lines',
      SW: 'Southwest Airlines',
      BA: 'British Airways',
      LH: 'Lufthansa',
      AF: 'Air France',
      KL: 'KLM',
      QF: 'Qantas',
      EK: 'Emirates',
    };
    return airlineMap[carrierCode] || carrierCode;
  }
}
