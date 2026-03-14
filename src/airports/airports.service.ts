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
