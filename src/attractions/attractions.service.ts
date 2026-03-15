import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { AttractionJobData } from '../common/types/attraction.types';

@Injectable()
export class AttractionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly revalidationService: RevalidationService,
  ) {}

  private async buildJobData(attractionId: string): Promise<AttractionJobData> {
    const attraction = await this.prisma.attraction.findUnique({
      where: { id: attractionId },
    });

    if (!attraction) {
      throw new NotFoundException(`Attraction ${attractionId} not found`);
    }

    // Look up country name
    const country = await this.prisma.country.findUnique({
      where: { code: attraction.countryCode },
    });

    return {
      attractionId: attraction.id,
      attractionName: attraction.name,
      countryCode: attraction.countryCode,
      countryName: country?.name || attraction.countryCode,
      city: attraction.city,
      latitude: attraction.latitude ?? undefined,
      longitude: attraction.longitude ?? undefined,
      slug: attraction.slug,
    };
  }

  async triggerGeneration(attractionId: string): Promise<void> {
    const jobData = await this.buildJobData(attractionId);

    const attraction = await this.prisma.attraction.findUnique({
      where: { id: attractionId },
    });

    if (attraction && attraction.status !== 'GENERATING') {
      await this.prisma.attraction.update({
        where: { id: attractionId },
        data: { status: 'PENDING' },
      });
    }

    await this.queueService.addGenerationJob(jobData);
    console.log(`[ATTRACTIONS] Job queued for: ${jobData.attractionName}`);
  }

  async triggerRegeneration(attractionId: string): Promise<void> {
    const jobData = await this.buildJobData(attractionId);

    await this.prisma.attraction.update({
      where: { id: attractionId },
      data: { status: 'PENDING', errorMessage: null },
    });

    await this.queueService.addGenerationJob(jobData);
    console.log(`[ATTRACTIONS] Regeneration job queued for: ${jobData.attractionName}`);
  }

  async getGenerationStatus(attractionId: string) {
    const attraction = await this.prisma.attraction.findUnique({
      where: { id: attractionId },
      select: {
        id: true,
        name: true,
        status: true,
        seoTitle: true,
        metaDescription: true,
        errorMessage: true,
        updatedAt: true,
      },
    });

    if (!attraction) return null;

    return {
      id: attraction.id,
      name: attraction.name,
      status: attraction.status.toLowerCase(),
      seoTitle: attraction.seoTitle,
      metaDescription: attraction.metaDescription,
      errorMessage: attraction.errorMessage,
      lastUpdated: attraction.updatedAt,
    };
  }

  // --- Public page data ---

  async getAttractionBySlug(slug: string) {
    const attraction = await this.prisma.attraction.findUnique({
      where: { slug },
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!attraction || attraction.status !== 'COMPLETED') return null;

    const country = await this.prisma.country.findUnique({
      where: { code: attraction.countryCode },
    });

    // Nearest airport to the attraction's city
    const nearestAirport = await this.prisma.airport.findFirst({
      where: { city: { equals: attraction.city, mode: 'insensitive' }, countryCode: attraction.countryCode },
      orderBy: { type: 'asc' },
    }) ?? await this.prisma.airport.findFirst({
      where: { countryCode: attraction.countryCode, type: 'large_airport' },
    });

    // Fetch nearby attractions (same city first, then same country)
    const nearby = await this.prisma.attraction.findMany({
      where: {
        status: 'COMPLETED',
        id: { not: attraction.id },
        OR: [
          { city: attraction.city },
          { countryCode: attraction.countryCode },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        photos: { take: 1 },
      },
    });

    return {
      id: attraction.id,
      name: attraction.name,
      slug: attraction.slug,
      country: country?.name || attraction.countryCode,
      countryCode: attraction.countryCode,
      city: attraction.city,
      seoTitle: attraction.seoTitle,
      metaDescription: attraction.metaDescription,
      contentHtml: attraction.contentHtml,
      bestTimeToVisit: attraction.bestTimeToVisit,
      entryFee: attraction.entryFee,
      photos: attraction.photos,
      nearbyAttractions: nearby,
      nearestAirportCode: nearestAirport?.iataCode ?? null,
      updatedAt: attraction.updatedAt,
    };
  }

  async getAllCompletedAttractions() {
    const attractions = await this.prisma.attraction.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        countryCode: true,
        city: true,
        seoTitle: true,
        metaDescription: true,
        photos: { take: 1 },
        updatedAt: true,
      },
    });

    // Fetch country names
    const countryCodes = [...new Set(attractions.map((a) => a.countryCode))];
    const countries = await this.prisma.country.findMany({
      where: { code: { in: countryCodes } },
    });
    const countryMap = new Map(countries.map((c) => [c.code, c.name]));

    return attractions.map((a) => ({
      ...a,
      country: countryMap.get(a.countryCode) || a.countryCode,
    }));
  }

  // --- Lookup endpoints for admin UI ---

  async getAllCountries() {
    return this.prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getCitiesByCountry(countryCode: string) {
    return this.prisma.city.findMany({
      where: { countryCode },
      orderBy: { name: 'asc' },
    });
  }

  async createAttraction(data: {
    name: string;
    countryCode: string;
    city: string;
    slug: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.prisma.attraction.create({ data });
  }

  // --- Edit / Update ---

  async getAttractionById(id: string) {
    const attraction = await this.prisma.attraction.findUnique({
      where: { id },
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!attraction) {
      throw new NotFoundException(`Attraction ${id} not found`);
    }

    const country = await this.prisma.country.findUnique({
      where: { code: attraction.countryCode },
    });

    return {
      ...attraction,
      country: country?.name || attraction.countryCode,
    };
  }

  async updateAttraction(id: string, data: {
    name?: string;
    seoTitle?: string;
    metaDescription?: string;
    contentHtml?: string;
    bestTimeToVisit?: string;
    entryFee?: string;
  }) {
    const attraction = await this.prisma.attraction.findUnique({ where: { id } });
    if (!attraction) {
      throw new NotFoundException(`Attraction ${id} not found`);
    }

    // If name changed, update slug too
    const updateData: any = { ...data };
    if (data.name && data.name !== attraction.name) {
      updateData.slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    const updated = await this.prisma.attraction.update({
      where: { id },
      data: updateData,
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });

    if (updated.status === 'COMPLETED') {
      await this.revalidationService.revalidatePath(`/attractions/${updated.slug}`);
    }

    return updated;
  }

  async addPhoto(attractionId: string, data: { imageUrl: string; altText: string; source?: string }) {
    const attraction = await this.prisma.attraction.findUnique({ where: { id: attractionId } });
    if (!attraction) {
      throw new NotFoundException(`Attraction ${attractionId} not found`);
    }

    return this.prisma.photo.create({
      data: {
        attractionId,
        imageUrl: data.imageUrl,
        altText: data.altText,
        source: data.source || 'manual',
      },
    });
  }

  async deletePhoto(photoId: string) {
    return this.prisma.photo.delete({ where: { id: photoId } });
  }

  async reorderPhotos(attractionId: string, photoIds: string[]) {
    const updates = photoIds.map((id, index) =>
      this.prisma.photo.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );
    await this.prisma.$transaction(updates);

    const attraction = await this.prisma.attraction.findUnique({ where: { id: attractionId }, select: { slug: true, status: true } });
    if (attraction?.status === 'COMPLETED') {
      await this.revalidationService.revalidatePath(`/attractions/${attraction.slug}`);
    }
  }

  async getAllAttractions() {
    return this.prisma.attraction.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        countryCode: true,
        city: true,
        slug: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    });
  }

  async getAttractionsPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    countryCode?: string;
  }) {
    const { page, pageSize, search, status, countryCode } = params;
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'ALL') where.status = status;
    if (countryCode && countryCode !== 'ALL') where.countryCode = countryCode;

    const [attractions, total] = await this.prisma.$transaction([
      this.prisma.attraction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, name: true, countryCode: true, city: true,
          slug: true, status: true, errorMessage: true, createdAt: true, updatedAt: true,
        },
      }),
      this.prisma.attraction.count({ where }),
    ]);

    const codes = [...new Set(attractions.map((a) => a.countryCode))];
    const countries = await this.prisma.country.findMany({ where: { code: { in: codes } } });
    const countryMap = new Map(countries.map((c) => [c.code, c.name]));

    return {
      data: attractions.map((a) => ({ ...a, countryName: countryMap.get(a.countryCode) || a.countryCode })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getStatusSummary() {
    const counts = await this.prisma.attraction.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const summary: Record<string, number> = { ALL: 0, PENDING: 0, GENERATING: 0, COMPLETED: 0, FAILED: 0 };
    counts.forEach((c) => {
      summary[c.status] = c._count.status;
      summary['ALL'] += c._count.status;
    });
    return summary;
  }

  async importFromJsonFile() {
    const path = require('path');
    const fs = require('fs');
    const filePath = path.join(process.cwd(), 'attractions.json');

    if (!fs.existsSync(filePath)) {
      throw new Error('attractions.json not found in project root');
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const bindings = raw?.results?.bindings || [];

    // Build country name→code map
    const countries = await this.prisma.country.findMany();
    const nameToCode = new Map(countries.map((c) => [c.name.toLowerCase(), c.code]));

    let inserted = 0, skipped = 0, errors = 0;
    const slugsSeen = new Set<string>();

    // Load existing slugs to avoid conflicts
    const existing = await this.prisma.attraction.findMany({ select: { slug: true } });
    existing.forEach((e) => slugsSeen.add(e.slug));

    for (const binding of bindings) {
      try {
        const name = binding?.siteLabel?.value;
        const countryName = binding?.countryLabel?.value;
        const cityName = binding?.cityLabel?.value || countryName;
        const imageUrl = binding?.image?.value;
        const coordsRaw = binding?.coords?.value; // "Point(lng lat)"

        if (!name || !countryName) { skipped++; continue; }

        const countryCode = nameToCode.get(countryName.toLowerCase());
        if (!countryCode) { skipped++; continue; }

        // Parse WKT coords
        let latitude: number | undefined, longitude: number | undefined;
        if (coordsRaw) {
          const match = coordsRaw.match(/Point\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/);
          if (match) { longitude = parseFloat(match[1]); latitude = parseFloat(match[2]); }
        }

        // Generate unique slug
        let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let slug = baseSlug;
        let counter = 2;
        while (slugsSeen.has(slug)) { slug = `${baseSlug}-${counter++}`; }
        slugsSeen.add(slug);

        // Upsert attraction
        const attraction = await this.prisma.attraction.upsert({
          where: { slug },
          update: {},
          create: { name, countryCode, city: cityName, slug, latitude, longitude },
        });

        // Add image if provided and no photos exist
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
        errors++;
        console.error('[IMPORT] Error:', e?.message);
      }
    }

    console.log(`[IMPORT] Done: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
    return { inserted, skipped, errors, total: bindings.length };
  }
}
