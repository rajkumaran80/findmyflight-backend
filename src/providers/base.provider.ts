import { FlightSearchParams, NormalizedFlight } from '../common/types';

/**
 * Interface that all flight providers must implement
 * This ensures consistency and allows for easy addition of new providers
 */
export interface IFlightProvider {
  name: string;
  
  /**
   * Search for flights from the provider's API
   * @param params Search parameters
   * @returns Array of normalized flights
   */
  search(params: FlightSearchParams): Promise<NormalizedFlight[]>;
  
  /**
   * Check if provider is available/healthy
   */
  isHealthy(): Promise<boolean>;
  
  /**
   * Validate if provider can handle the search
   */
  canHandle(params: FlightSearchParams): boolean;
}

/**
 * Base abstract class for flight providers
 * Provides common functionality and enforces interface implementation
 */
export abstract class BaseFlightProvider implements IFlightProvider {
  abstract name: string;
  protected apiKey: string;
  protected apiSecret?: string;
  protected baseUrl: string = '';

  constructor(apiKey: string, apiSecret?: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  abstract search(params: FlightSearchParams): Promise<NormalizedFlight[]>;

  async isHealthy(): Promise<boolean> {
    // Override in subclass for custom health check
    return !!this.apiKey;
  }

  canHandle(params: FlightSearchParams): boolean {
    // Override in subclass for specific limitations
    // e.g., Amadeus might not support certain airports
    return true;
  }

  /**
   * Normalize a flight response to our standard format
   * Each provider implements their own version
   */
  protected abstract normalize(rawFlight: any, params?: any): NormalizedFlight;
}
