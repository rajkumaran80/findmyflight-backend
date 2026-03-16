import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Metropolitan / city-group codes not present in the airports DB
const METRO_CODES: { code: string; name: string; city: string; country: string; keywords: string }[] = [
  { code: 'LON', name: 'All London Airports', city: 'London', country: 'GB', keywords: 'LHR LGW LCY LTN STN' },
  { code: 'NYC', name: 'All New York Airports', city: 'New York', country: 'US', keywords: 'JFK LGA EWR' },
  { code: 'PAR', name: 'All Paris Airports', city: 'Paris', country: 'FR', keywords: 'CDG ORY BVA' },
  { code: 'MIL', name: 'All Milan Airports', city: 'Milan', country: 'IT', keywords: 'MXP LIN BGY' },
  { code: 'TYO', name: 'All Tokyo Airports', city: 'Tokyo', country: 'JP', keywords: 'NRT HND' },
  { code: 'OSA', name: 'All Osaka Airports', city: 'Osaka', country: 'JP', keywords: 'KIX ITM UKB' },
  { code: 'CHI', name: 'All Chicago Airports', city: 'Chicago', country: 'US', keywords: 'ORD MDW' },
  { code: 'WAS', name: 'All Washington DC Airports', city: 'Washington DC', country: 'US', keywords: 'IAD DCA BWI' },
  { code: 'MOW', name: 'All Moscow Airports', city: 'Moscow', country: 'RU', keywords: 'SVO DME VKO' },
  { code: 'STO', name: 'All Stockholm Airports', city: 'Stockholm', country: 'SE', keywords: 'ARN BMA NYO' },
  { code: 'BUE', name: 'All Buenos Aires Airports', city: 'Buenos Aires', country: 'AR', keywords: 'EZE AEP' },
  { code: 'RIO', name: 'All Rio de Janeiro Airports', city: 'Rio de Janeiro', country: 'BR', keywords: 'GIG SDU' },
  { code: 'SEL', name: 'All Seoul Airports', city: 'Seoul', country: 'KR', keywords: 'ICN GMP' },
  { code: 'SPK', name: 'All Sapporo Airports', city: 'Sapporo', country: 'JP', keywords: 'CTS OKD' },
  { code: 'BJS', name: 'All Beijing Airports', city: 'Beijing', country: 'CN', keywords: 'PEK PKX' },
  { code: 'SHA', name: 'All Shanghai Airports', city: 'Shanghai', country: 'CN', keywords: 'PVG SHA' },
  { code: 'YTO', name: 'All Toronto Airports', city: 'Toronto', country: 'CA', keywords: 'YYZ YTZ YHM' },
  { code: 'YMQ', name: 'All Montreal Airports', city: 'Montreal', country: 'CA', keywords: 'YUL YMX' },
  { code: 'GLA', name: 'All Glasgow Airports', city: 'Glasgow', country: 'GB', keywords: 'GLA PIK' },
  { code: 'IST', name: 'All Istanbul Airports', city: 'Istanbul', country: 'TR', keywords: 'IST SAW' },
  { code: 'DTT', name: 'All Detroit Airports', city: 'Detroit', country: 'US', keywords: 'DTW YIP' },
  { code: 'BHZ', name: 'All Belo Horizonte Airports', city: 'Belo Horizonte', country: 'BR', keywords: 'CNF PLU' },
  { code: 'OKA', name: 'All Okinawa Airports', city: 'Okinawa', country: 'JP', keywords: 'OKA ISG MMY' },
];

function metroMatches(m: typeof METRO_CODES[0], term: string, q: string): boolean {
  return (
    m.code.startsWith(term) ||
    m.city.toLowerCase().includes(q.toLowerCase()) ||
    m.name.toLowerCase().includes(q.toLowerCase())
  );
}

@Injectable()
export class AirportsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, limit = 20) {
    if (!q || q.trim().length < 1) return [];

    const term = q.trim().toUpperCase();

    // Prioritise exact IATA code, then starts-with, then name/city ILIKE
    const [exact, startsWith, rest] = await Promise.all([
      this.prisma.airport.findMany({
        where: { iataCode: term },
        take: 1,
      }),
      this.prisma.airport.findMany({
        where: {
          iataCode: { startsWith: term },
          NOT: { iataCode: term },
        },
        orderBy: { type: 'asc' }, // large_airport first alphabetically
        take: 5,
      }),
      this.prisma.airport.findMany({
        where: {
          AND: [
            { iataCode: { not: { startsWith: term } } },
            {
              OR: [
                { city: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { keywords: { contains: q, mode: 'insensitive' } },
              ],
            },
          ],
        },
        orderBy: { type: 'asc' },
        take: limit,
      }),
    ]);

    // Match metropolitan/city-group codes first
    const metroMatched = METRO_CODES.filter((m) => metroMatches(m, term, q));

    const seen = new Set<string>();
    const results: { code: string; name: string; city: string; country: string; keywords: string }[] = [];

    // Metro codes at top (exact code match first, then city name matches)
    for (const m of metroMatched) {
      if (!seen.has(m.code)) {
        seen.add(m.code);
        results.push(m);
      }
    }

    for (const a of [...exact, ...startsWith, ...rest]) {
      if (!seen.has(a.iataCode)) {
        seen.add(a.iataCode);
        results.push({
          code: a.iataCode,
          name: a.name,
          city: a.city,
          country: a.countryCode,
          keywords: a.keywords ?? '',
        });
      }
      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  }

  async findNearest(lat: number, lng: number, limit = 1) {
    const airports = await this.prisma.airport.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { iataCode: true, name: true, city: true, countryCode: true, latitude: true, longitude: true },
    });

    const toRad = (d: number) => (d * Math.PI) / 180;
    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return airports
      .map((a) => ({ ...a, distance: haversine(lat, lng, a.latitude!, a.longitude!) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
      .map(({ iataCode, name, city, countryCode, distance }) => ({
        code: iataCode,
        name,
        city,
        country: countryCode,
        distanceKm: Math.round(distance),
      }));
  }

  async findNearestByCity(city: string, countryCode: string): Promise<string | null> {
    const byCity = await this.prisma.airport.findFirst({
      where: { city: { equals: city, mode: 'insensitive' }, countryCode: countryCode.toUpperCase() },
      orderBy: { type: 'asc' },
    });
    if (byCity) return byCity.iataCode;

    const byCountry = await this.prisma.airport.findFirst({
      where: { countryCode: countryCode.toUpperCase(), type: 'large_airport' },
    });
    return byCountry?.iataCode ?? null;
  }

  async findByCode(code: string) {
    const airport = await this.prisma.airport.findUnique({
      where: { iataCode: code.toUpperCase() },
    });
    if (!airport) return null;
    return {
      code: airport.iataCode,
      name: airport.name,
      city: airport.city,
      country: airport.countryCode,
      keywords: airport.keywords ?? '',
    };
  }
}
