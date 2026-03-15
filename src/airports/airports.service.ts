import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    const seen = new Set<string>();
    const results = [];
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

    return results;
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
