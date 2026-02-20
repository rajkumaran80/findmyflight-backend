/**
 * Normalized flight object that all providers must return
 * This ensures consistency across all flight APIs
 */
export interface NormalizedFlight {
  id: string; // Unique identifier (combination of provider + their ID)
  provider: string; // Which API provided this (amadeus, kiwi, skyscanner)
  airline: string;
  airlineCode: string;
  departureTime: string; // ISO 8601 format
  arrivalTime: string; // ISO 8601 format
  duration: number; // In minutes
  stops: number;
  stopDetails?: StopDetail[];
  
  price: number;
  currency: string;
  
  bookingUrl: string; // Affiliate deep link for monetization
  tripType: 'one-way' | 'round-trip' | 'multi-city';
  
  // Search metadata
  departureAirport: string; // IATA code
  arrivalAirport: string; // IATA code
  departureDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD for round-trip
  
  // Score for ranking
  rankingScore?: number;
  scoreBreakdown?: ScoreBreakdown;
}

export interface StopDetail {
  airport: string;
  duration: number; // In minutes
}

export interface ScoreBreakdown {
  priceScore: number;
  durationScore: number;
  stopsScore: number;
  totalScore: number;
}

/**
 * Passenger breakdown for searches
 */
export interface PassengerBreakdown {
  adults: number; // 18+
  children: number; // 2-17 (Kids)
  infants: number; // 0-2 (Infants)
}

/**
 * Multi-city flight segment
 */
export interface FlightSegment {
  from: string; // IATA code
  to: string; // IATA code
  departDate: string; // YYYY-MM-DD
}

/**
 * Search parameters from the frontend
 */
export interface FlightSearchParams {
  // Single city pair or first segment
  from: string; // IATA airport code
  to: string; // IATA airport code
  departDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD (for round-trip)

  // Passenger info
  passengers?: number; // Legacy: total passengers (deprecated, use passengerBreakdown)
  passengerBreakdown?: PassengerBreakdown; // New: detailed breakdown (Adults, Kids, Infants)

  // Trip type and multi-city
  tripType: 'one-way' | 'round-trip' | 'multi-city';
  segments?: FlightSegment[]; // For multi-city searches (array of segments)

  // Preferences
  cabin?: 'economy' | 'business' | 'first' | 'premium-economy';
  maxPrice?: number;
  airlines?: string[]; // Filter by specific airlines
  includeProviders?: string[]; // Which providers to query
}

/**
 * Aggregated search results
 */
export interface FlightSearchResult {
  status: 'success' | 'partial' | 'error';
  query: FlightSearchParams;
  flights: NormalizedFlight[];
  totalResults: number;
  providersQueried: ProviderStatus[];
  timestamp: string;
  cacheHit: boolean;
}

/**
 * Provider status after search
 */
export interface ProviderStatus {
  name: string;
  status: 'success' | 'error' | 'timeout';
  resultsCount: number;
  error?: string;
  responseTime: number; // In milliseconds
}
