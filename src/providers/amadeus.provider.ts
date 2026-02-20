import axios, { Axios } from 'axios';
import { BaseFlightProvider } from './base.provider';
import { FlightSearchParams, NormalizedFlight } from '../common/types';

/**
 * Amadeus API Provider Implementation
 * Reference: https://developers.amadeus.com/apis
 */
export class AmadeusProvider extends BaseFlightProvider {
  name = 'amadeus';
  protected baseUrl = 'https://test.api.amadeus.com/v2';
  private httpClient: Axios;
  private accessToken: string = '';
  private tokenExpiry: number = 0;

  constructor(apiKey: string, apiSecret: string) {
    super(apiKey, apiSecret);
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  async search(params: FlightSearchParams): Promise<NormalizedFlight[]> {
    try {
      // Ensure we have a valid access token
      await this.ensureValidToken();

      const amadeusParams = this.buildSearchParams(params);
      
      console.log('[AMADEUS] Search params:', JSON.stringify(amadeusParams, null, 2));
      
      const response = await this.httpClient.get('/shopping/flight-offers', {
        params: amadeusParams,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      console.log('[AMADEUS] Response status:', response.status);
      console.log('[AMADEUS] Response data:', JSON.stringify(response.data, null, 2));

      if (!response.data.data || response.data.data.length === 0) {
        console.log('[AMADEUS] No flights found in response');
        return [];
      }

      console.log('[AMADEUS] Found', response.data.data.length, 'flights');
      return response.data.data.map((flight: any) =>
        this.normalize(flight, params),
      );
    } catch (error) {
      console.error(`[AMADEUS] Provider error:`, error instanceof Error ? error.message : error);
      if (axios.isAxiosError(error)) {
        console.error('[AMADEUS] Response data:', error.response?.data);
        console.error('[AMADEUS] Response status:', error.response?.status);
      }
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      return true;
    } catch {
      return false;
    }
  }

  canHandle(params: FlightSearchParams): boolean {
    // Amadeus supports most major airports
    // In production, maintain a list of supported airports
    return true;
  }

  /**
   * Get access token from Amadeus Auth API
   */
  private async getAccessToken(): Promise<string> {
    try {
      console.log('[AMADEUS] Requesting access token...');
      const response = await axios.post(
        `${this.baseUrl}/auth/oauth2/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.apiKey,
          client_secret: this.apiSecret,
        },
        {
          timeout: 5000,
        },
      );

      this.accessToken = response.data.access_token;
      // Token typically expires in 1799 seconds, refresh at 1700 seconds
      this.tokenExpiry = Date.now() + 1700 * 1000;

      console.log('[AMADEUS] Access token obtained successfully, expires in ~28 minutes');
      return this.accessToken;
    } catch (error) {
      console.error('[AMADEUS] Failed to get access token:', error instanceof Error ? error.message : error);
      if (axios.isAxiosError(error)) {
        console.error('[AMADEUS] Token response data:', error.response?.data);
        console.error('[AMADEUS] Token response status:', error.response?.status);
      }
      throw new Error('Amadeus authentication failed');
    }
  }

  /**
   * Ensure we have a valid, non-expired access token
   */
  private async ensureValidToken(): Promise<void> {
    if (Date.now() > this.tokenExpiry) {
      await this.getAccessToken();
    }
  }

  /**
   * Build Amadeus-specific query parameters
   */
  private buildSearchParams(params: FlightSearchParams): Record<string, any> {
    const searchParams: Record<string, any> = {
      originLocationCode: params.from,
      destinationLocationCode: params.to,
      departureDate: params.departDate,
      adults: params.passengers,
      currencyCode: 'USD', // Default, could be extended
    };

    if (params.tripType === 'round-trip' && params.returnDate) {
      searchParams.returnDate = params.returnDate;
    }

    if (params.cabin) {
      searchParams.travelClass = this.mapCabin(params.cabin);
    }

    if (params.maxPrice) {
      searchParams.maxPrice = params.maxPrice;
    }

    searchParams.max = 50; // Return top 50 results

    return searchParams;
  }

  /**
   * Map our cabin types to Amadeus cabin types
   */
  private mapCabin(cabin: string): string {
    const cabinMap: Record<string, string> = {
      economy: 'ECONOMY',
      'premium-economy': 'PREMIUM_ECONOMY',
      business: 'BUSINESS',
      first: 'FIRST',
    };
    return cabinMap[cabin] || 'ECONOMY';
  }

  /**
   * Normalize Amadeus response to our standard format
   * Example Amadeus response structure:
   * {
   *   id: "1",
   *   source: "GDS",
   *   instantTicketingRequired: false,
   *   nonHomogeneous: false,
   *   oneWay: false,
   *   lastTicketingDate: "2023-03-01",
   *   numberOfBookableSeats: 4,
   *   itineraries: [{
   *     duration: "PT10H30M",
   *     segments: [{
   *       departure: {...},
   *       arrival: {...},
   *       carrierCode: "AA",
   *       operating: {...}
   *     }]
   *   }],
   *   price: {
   *     currency: "EUR",
   *     total: "798.90",
   *     base: "600.00",
   *     fees: [{...}],
   *     grandTotal: "798.90"
   *   },
   *   pricingOptions: {...},
   *   validatingAirlineCodes: ["AA"],
   *   travelerPricings: [...]
   * }
   */
  protected normalize(rawFlight: any, params: FlightSearchParams): NormalizedFlight {
    const itinerary = rawFlight.itineraries[0];
    const firstSegment = itinerary.segments[0];
    const lastSegment = itinerary.segments[itinerary.segments.length - 1];

    // Calculate duration in minutes
    const durationStr = itinerary.duration; // Format: PT10H30M
    const durationMinutes = this.parseDiurationISO8601(durationStr);

    const stops = itinerary.segments.length - 1;

    // Generate deep link for booking (affiliate)
    const bookingUrl = `https://www.kiwi.com/deep?${new URLSearchParams({
      from: params.from,
      to: params.to,
      departure: params.departDate,
      return: params.returnDate || '',
      flightId: rawFlight.id,
      affiliateId: process.env.KIWI_AFFILIATE_ID || 'findmyflight',
    }).toString()}`;

    return {
      id: `amadeus_${rawFlight.id}`,
      provider: this.name,
      airline: this.getAirlineName(firstSegment.carrierCode),
      airlineCode: firstSegment.carrierCode,
      departureTime: firstSegment.departure.at,
      arrivalTime: lastSegment.arrival.at,
      duration: durationMinutes,
      stops: stops,
      stopDetails: this.buildStopDetails(itinerary.segments),
      price: parseFloat(rawFlight.price.grandTotal),
      currency: rawFlight.price.currency,
      bookingUrl: bookingUrl,
      tripType: params.tripType,
      departureAirport: params.from,
      arrivalAirport: params.to,
      departureDate: params.departDate,
      returnDate: params.returnDate,
    };
  }

  /**
   * Parse ISO8601 duration format
   * Example: PT10H30M -> 630 minutes
   */
  private parseDiurationISO8601(duration: string): number {
    const regex = /PT(\d+H)?(\d+M)?/;
    const matches = duration.match(regex);

    let totalMinutes = 0;

    if (matches && matches[1]) {
      totalMinutes += parseInt(matches[1]) * 60;
    }

    if (matches && matches[2]) {
      totalMinutes += parseInt(matches[2]);
    }

    return totalMinutes;
  }

  /**
   * Build stop details from segments
   */
  private buildStopDetails(segments: any[]): any[] {
    // Skip first segment (it's the departure, not a stop)
    return segments.slice(1).map((segment, index) => {
      const prevSegment = segments[index];
      // Duration at the stop in minutes
      const duration =
        (new Date(segment.departure.at).getTime() -
          new Date(prevSegment.arrival.at).getTime()) /
        60000;

      return {
        airport: segment.departure.iataCode,
        duration: Math.round(duration),
      };
    });
  }

  /**
   * Get human-readable airline name from carrier code
   * In production, use an airline database
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
