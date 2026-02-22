import { BaseFlightProvider } from './base.provider';
import { FlightSearchParams, NormalizedFlight, FlightItinerary } from '../common/types';

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

    const totalPassengers = params.passengerBreakdown
      ? (params.passengerBreakdown.adults + params.passengerBreakdown.children + params.passengerBreakdown.infants)
      : (params.passengers ?? 1);

    const cabin = params.cabin ? this.mapCabinLabel(params.cabin) : 'Economy';
    const isRoundTrip = params.tripType === 'round-trip' && params.returnDate;

    const flightConfigs = [
      { id: 'demo_1', code: 'DL', name: 'Delta Air Lines', depH: '08:00', arrH: '11:30', dur: 210, stops: 0, price: 450, flightNum: 'DL402', aircraft: '767' },
      { id: 'demo_2', code: 'UA', name: 'United Airlines', depH: '10:15', arrH: '14:30', dur: 255, stops: 1, price: 380, flightNum: 'UA891', aircraft: '777', stopAirport: 'ORD', stopDep: '12:00', stopArr: '11:30' },
      { id: 'demo_3', code: 'AA', name: 'American Airlines', depH: '12:45', arrH: '16:00', dur: 195, stops: 0, price: 520, flightNum: 'AA245', aircraft: 'A321' },
      { id: 'demo_4', code: 'SW', name: 'Southwest Airlines', depH: '14:30', arrH: '18:45', dur: 255, stops: 1, price: 340, flightNum: 'SW1832', aircraft: '737', stopAirport: 'DFW', stopDep: '16:15', stopArr: '15:45' },
      { id: 'demo_5', code: 'B6', name: 'JetBlue Airways', depH: '07:00', arrH: '10:30', dur: 210, stops: 0, price: 480, flightNum: 'B6517', aircraft: 'A220' },
    ];

    const mockFlights: NormalizedFlight[] = flightConfigs.map((cfg) => {
      const depTime = new Date(params.departDate + `T${cfg.depH}:00Z`).toISOString();
      const arrTime = new Date(params.departDate + `T${cfg.arrH}:00Z`).toISOString();

      // Build outbound itinerary
      const outbound = this.buildMockItinerary(
        'outbound', params.from, params.to, params.departDate,
        cfg.depH, cfg.arrH, cfg.dur, cfg.stops, cfg.code, cfg.name, cfg.flightNum, cfg.aircraft, cabin,
        cfg.stopAirport, cfg.stopDep, cfg.stopArr,
      );

      const itineraries: FlightItinerary[] = [outbound];

      // Build inbound itinerary for round-trip
      if (isRoundTrip && params.returnDate) {
        // Return flight is ~2 hours later departure, slightly different duration
        const retDepH = this.offsetTime(cfg.depH, 2);
        const retDur = cfg.dur + (cfg.stops === 0 ? -15 : 10);
        const retArrMinutes = this.timeToMinutes(retDepH) + retDur;
        const retArrH = this.minutesToTime(retArrMinutes);
        const retFlightNum = cfg.code + String(parseInt(cfg.flightNum.replace(/\D/g, '')) + 1);

        const inbound = this.buildMockItinerary(
          'inbound', params.to, params.from, params.returnDate,
          retDepH, retArrH, retDur, cfg.stops, cfg.code, cfg.name, retFlightNum, cfg.aircraft, cabin,
          cfg.stopAirport,
          cfg.stops > 0 ? this.offsetTime(retDepH, 1.5) : undefined,
          cfg.stops > 0 ? this.offsetTime(retDepH, 1) : undefined,
        );
        itineraries.push(inbound);
      }

      return {
        id: cfg.id,
        provider: 'demo',
        airline: cfg.name,
        airlineCode: cfg.code,
        departureTime: depTime,
        arrivalTime: arrTime,
        departureAirport: params.from,
        arrivalAirport: params.to,
        duration: cfg.dur,
        stops: cfg.stops,
        itineraries,
        price: cfg.price * totalPassengers,
        currency: 'USD',
        tripType: params.tripType,
        departureDate: params.departDate,
        returnDate: params.returnDate,
        bookingUrl: `https://www.${cfg.name.toLowerCase().replace(/\s/g, '')}.com/book?from=${params.from}&to=${params.to}&date=${params.departDate}`,
        rankingScore: 0,
        scoreBreakdown: { priceScore: 0, durationScore: 0, stopsScore: 0, totalScore: 0 },
      };
    });

    if (params.airlines && params.airlines.length > 0) {
      return mockFlights.filter((f) => params.airlines!.includes(f.airlineCode));
    }

    return mockFlights;
  }

  private buildMockItinerary(
    direction: 'outbound' | 'inbound',
    from: string, to: string, date: string,
    depH: string, arrH: string, totalDur: number, stops: number,
    code: string, name: string, flightNum: string, aircraft: string, cabin: string,
    stopAirport?: string, stopDepH?: string, stopArrH?: string,
  ): FlightItinerary {
    if (stops === 0 || !stopAirport) {
      return {
        direction,
        duration: totalDur,
        stops: 0,
        segments: [{
          departureAirport: from,
          departureTime: new Date(date + `T${depH}:00Z`).toISOString(),
          arrivalAirport: to,
          arrivalTime: new Date(date + `T${arrH}:00Z`).toISOString(),
          carrierCode: code,
          carrierName: name,
          flightNumber: flightNum,
          aircraft,
          duration: totalDur,
          cabin,
        }],
      };
    }

    // 1-stop: split into 2 segments
    const seg1Arr = stopArrH || this.offsetTime(depH, 1.5);
    const seg2Dep = stopDepH || this.offsetTime(depH, 2);
    const seg1Dur = this.timeToMinutes(seg1Arr) - this.timeToMinutes(depH);
    const seg2Dur = this.timeToMinutes(arrH) - this.timeToMinutes(seg2Dep);

    return {
      direction,
      duration: totalDur,
      stops: 1,
      segments: [
        {
          departureAirport: from,
          departureTime: new Date(date + `T${seg1Arr.length === 5 ? depH : depH}:00Z`).toISOString(),
          arrivalAirport: stopAirport,
          arrivalTime: new Date(date + `T${seg1Arr}:00Z`).toISOString(),
          carrierCode: code,
          carrierName: name,
          flightNumber: flightNum,
          aircraft,
          duration: Math.max(seg1Dur, 60),
          cabin,
        },
        {
          departureAirport: stopAirport,
          departureTime: new Date(date + `T${seg2Dep}:00Z`).toISOString(),
          arrivalAirport: to,
          arrivalTime: new Date(date + `T${arrH}:00Z`).toISOString(),
          carrierCode: code,
          carrierName: name,
          flightNumber: code + String(parseInt(flightNum.replace(/\D/g, '')) + 100),
          aircraft,
          duration: Math.max(seg2Dur, 60),
          cabin,
        },
      ],
    };
  }

  private mapCabinLabel(cabin: string): string {
    const map: Record<string, string> = {
      economy: 'Economy',
      'premium-economy': 'Premium Economy',
      business: 'Business',
      first: 'First',
    };
    return map[cabin] || 'Economy';
  }

  private offsetTime(time: string, hours: number): string {
    const mins = this.timeToMinutes(time) + Math.round(hours * 60);
    return this.minutesToTime(mins);
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  canHandle(params: FlightSearchParams): boolean {
    return true;
  }

  protected normalize(rawFlight: any, params: FlightSearchParams): NormalizedFlight {
    return rawFlight;
  }
}
