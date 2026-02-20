import { BaseFlightProvider } from './base.provider';
import { FlightSearchParams, NormalizedFlight } from '../common/types';

/**
 * Demo Provider - Returns mock flights for testing
 * No API keys required, useful for testing UI/ranking/filtering
 */
export class DemoProvider extends BaseFlightProvider {
  name = 'demo';

  constructor() {
    super('demo', 'demo');
  }

  async search(params: FlightSearchParams): Promise<NormalizedFlight[]> {
    console.log('[DEMO] Generating mock flights for', params.from, '->', params.to);
    
    // Get passenger count (support both old and new format)
    const adults = params.passengerBreakdown?.adults || (params.passengers ?? 1);
    const totalPassengers = params.passengerBreakdown 
      ? (params.passengerBreakdown.adults + params.passengerBreakdown.children + params.passengerBreakdown.infants)
      : (params.passengers ?? 1);

    // Generate realistic mock flights with airline variety
    const airlines = [
      { code: 'DL', name: 'Delta Air Lines' },
      { code: 'UA', name: 'United Airlines' },
      { code: 'AA', name: 'American Airlines' },
      { code: 'SW', name: 'Southwest Airlines' },
      { code: 'B6', name: 'JetBlue Airways' },
    ];

    const mockFlights: NormalizedFlight[] = [
      {
        id: 'demo_1',
        provider: 'demo',
        airline: 'Delta Air Lines',
        airlineCode: 'DL',
        departureTime: new Date(params.departDate + 'T08:00:00Z').toISOString(),
        arrivalTime: new Date(params.departDate + 'T11:30:00Z').toISOString(),
        departureAirport: params.from,
        arrivalAirport: params.to,
        duration: 210,
        stops: 0,
        price: 450 * totalPassengers,
        currency: 'USD',
        tripType: params.tripType,
        departureDate: params.departDate,
        bookingUrl: `https://www.delta.com/book?from=${params.from}&to=${params.to}&date=${params.departDate}`,
        rankingScore: 0,
        scoreBreakdown: { priceScore: 85, durationScore: 90, stopsScore: 100, totalScore: 90 },
      },
      {
        id: 'demo_2',
        provider: 'demo',
        airline: 'United Airlines',
        airlineCode: 'UA',
        departureTime: new Date(params.departDate + 'T10:15:00Z').toISOString(),
        arrivalTime: new Date(params.departDate + 'T14:30:00Z').toISOString(),
        departureAirport: params.from,
        arrivalAirport: params.to,
        duration: 255,
        stops: 1,
        price: 380 * totalPassengers,
        currency: 'USD',
        tripType: params.tripType,
        departureDate: params.departDate,
        bookingUrl: `https://www.united.com/book?from=${params.from}&to=${params.to}&date=${params.departDate}`,
        rankingScore: 0,
        scoreBreakdown: { priceScore: 95, durationScore: 70, stopsScore: 50, totalScore: 80 },
      },
      {
        id: 'demo_3',
        provider: 'demo',
        airline: 'American Airlines',
        airlineCode: 'AA',
        departureTime: new Date(params.departDate + 'T12:45:00Z').toISOString(),
        arrivalTime: new Date(params.departDate + 'T16:00:00Z').toISOString(),
        departureAirport: params.from,
        arrivalAirport: params.to,
        duration: 195,
        stops: 0,
        price: 520 * totalPassengers,
        currency: 'USD',
        tripType: params.tripType,
        departureDate: params.departDate,
        bookingUrl: `https://www.aa.com/book?from=${params.from}&to=${params.to}&date=${params.departDate}`,
        rankingScore: 0,
        scoreBreakdown: { priceScore: 75, durationScore: 95, stopsScore: 100, totalScore: 88 },
      },
      {
        id: 'demo_4',
        provider: 'demo',
        airline: 'Southwest Airlines',
        airlineCode: 'SW',
        departureTime: new Date(params.departDate + 'T14:30:00Z').toISOString(),
        arrivalTime: new Date(params.departDate + 'T18:45:00Z').toISOString(),
        departureAirport: params.from,
        arrivalAirport: params.to,
        duration: 255,
        stops: 1,
        price: 340 * totalPassengers,
        currency: 'USD',
        tripType: params.tripType,
        departureDate: params.departDate,
        bookingUrl: `https://www.southwest.com/book?from=${params.from}&to=${params.to}&date=${params.departDate}`,
        rankingScore: 0,
        scoreBreakdown: { priceScore: 98, durationScore: 65, stopsScore: 50, totalScore: 75 },
      },
      {
        id: 'demo_5',
        provider: 'demo',
        airline: 'JetBlue Airways',
        airlineCode: 'B6',
        departureTime: new Date(params.departDate + 'T07:00:00Z').toISOString(),
        arrivalTime: new Date(params.departDate + 'T10:30:00Z').toISOString(),
        departureAirport: params.from,
        arrivalAirport: params.to,
        duration: 210,
        stops: 0,
        price: 480 * totalPassengers,
        currency: 'USD',
        tripType: params.tripType,
        departureDate: params.departDate,
        bookingUrl: `https://www.jetblue.com/book?from=${params.from}&to=${params.to}&date=${params.departDate}`,
        rankingScore: 0,
        scoreBreakdown: { priceScore: 80, durationScore: 90, stopsScore: 100, totalScore: 92 },
      },
    ];

    // Filter by airline if specified
    if (params.airlines && params.airlines.length > 0) {
      return mockFlights.filter((f) => params.airlines!.includes(f.airlineCode));
    }

    return mockFlights;
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  canHandle(params: FlightSearchParams): boolean {
    return true;
  }

  protected normalize(rawFlight: any, params: FlightSearchParams): NormalizedFlight {
    // Demo provider already returns normalized flights
    return rawFlight;
  }
}
