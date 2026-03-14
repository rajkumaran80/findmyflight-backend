import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { COUNTRIES, CITIES_BY_COUNTRY } from './seed-data';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedAll() {
    const result = {
      countries: 0,
      cities: 0,
      airports: 0,
      attractions: 0,
    };

    result.countries = await this.seedCountries();
    result.cities = await this.seedCities();
    result.airports = await this.seedAirports();
    result.attractions = await this.seedAttractions();

    return result;
  }

  private async seedCountries(): Promise<number> {
    const existing = await this.prisma.country.count();
    if (existing > 0) {
      this.logger.log(`Countries already seeded (${existing}), skipping`);
      return 0;
    }

    this.logger.log(`Seeding ${COUNTRIES.length} countries...`);
    for (const country of COUNTRIES) {
      await this.prisma.country.upsert({
        where: { code: country.code },
        update: { name: country.name },
        create: country,
      });
    }
    this.logger.log('Countries seeded.');
    return COUNTRIES.length;
  }

  private async seedCities(): Promise<number> {
    const existing = await this.prisma.city.count();
    if (existing > 0) {
      this.logger.log(`Cities already seeded (${existing}), skipping`);
      return 0;
    }

    let total = 0;
    for (const [countryCode, cities] of Object.entries(CITIES_BY_COUNTRY)) {
      for (const [name, latitude, longitude] of cities) {
        await this.prisma.city.upsert({
          where: { name_countryCode: { name, countryCode } },
          update: { latitude, longitude },
          create: { name, countryCode, latitude, longitude },
        });
        total++;
      }
    }
    this.logger.log(`${total} cities seeded.`);
    return total;
  }

  private async seedAirports(): Promise<number> {
    const existing = await this.prisma.airport.count();
    if (existing > 0) {
      this.logger.log(`Airports already seeded (${existing}), skipping`);
      return 0;
    }

    const jsonPath = path.join(__dirname, '../../scripts/data/airports.json');
    if (!fs.existsSync(jsonPath)) {
      this.logger.warn(`airports.json not found at ${jsonPath}, skipping airports`);
      return 0;
    }

    const airports: any[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    this.logger.log(`Seeding ${airports.length} airports...`);

    for (const airport of airports) {
      await this.prisma.airport.upsert({
        where: { iataCode: airport.iataCode },
        update: {},
        create: airport,
      });
    }
    this.logger.log(`${airports.length} airports seeded.`);
    return airports.length;
  }

  private async seedAttractions(): Promise<number> {
    const existing = await this.prisma.attraction.count();
    if (existing > 0) {
      this.logger.log(`Attractions already seeded (${existing}), skipping`);
      return 0;
    }

    const jsonPath = path.join(__dirname, '../../attractions.json');
    if (!fs.existsSync(jsonPath)) {
      this.logger.warn(`attractions.json not found at ${jsonPath}, skipping attractions`);
      return 0;
    }

    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const bindings: any[] = raw?.results?.bindings || [];
    this.logger.log(`Seeding ${bindings.length} attractions...`);

    const countries = await this.prisma.country.findMany();
    const nameToCode = new Map(countries.map((c) => [c.name.toLowerCase(), c.code]));
    const slugsSeen = new Set<string>();

    let inserted = 0;
    for (const binding of bindings) {
      try {
        const name: string = binding?.siteLabel?.value;
        const countryName: string = binding?.countryLabel?.value;
        const cityName: string = binding?.cityLabel?.value || countryName;
        const imageUrl: string | undefined = binding?.image?.value;
        const coordsRaw: string | undefined = binding?.coords?.value;

        if (!name || !countryName) continue;
        const countryCode = nameToCode.get(countryName.toLowerCase());
        if (!countryCode) continue;

        let latitude: number | undefined, longitude: number | undefined;
        if (coordsRaw) {
          const match = coordsRaw.match(/Point\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/);
          if (match) {
            longitude = parseFloat(match[1]);
            latitude = parseFloat(match[2]);
          }
        }

        let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let slug = baseSlug;
        let counter = 2;
        while (slugsSeen.has(slug)) { slug = `${baseSlug}-${counter++}`; }
        slugsSeen.add(slug);

        const attraction = await this.prisma.attraction.upsert({
          where: { slug },
          update: {},
          create: { name, countryCode, city: cityName, slug, latitude, longitude },
        });

        if (imageUrl) {
          const photoCount = await this.prisma.photo.count({ where: { attractionId: attraction.id } });
          if (photoCount === 0) {
            await this.prisma.photo.create({
              data: {
                attractionId: attraction.id,
                imageUrl,
                altText: `${name} - ${cityName}, ${countryName}`,
                source: 'wikimedia',
              },
            });
          }
        }

        inserted++;
      } catch (e: any) {
        this.logger.error(`[ERROR] ${e?.message}`);
      }
    }

    this.logger.log(`${inserted} attractions seeded.`);
    return inserted;
  }
}
