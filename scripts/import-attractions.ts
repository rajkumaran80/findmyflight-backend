import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../node_modules/prisma-client';

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, '..', 'attractions.json');
  if (!fs.existsSync(filePath)) {
    console.error('attractions.json not found at', filePath);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const bindings: any[] = raw?.results?.bindings || [];
  console.log(`Found ${bindings.length} entries in attractions.json`);

  // Build country name → code map
  const countries = await prisma.country.findMany();
  const nameToCode = new Map(countries.map((c) => [c.name.toLowerCase(), c.code]));

  // Load existing slugs
  const existing = await prisma.attraction.findMany({ select: { slug: true } });
  const slugsSeen = new Set(existing.map((e) => e.slug));

  let inserted = 0, skipped = 0, errors = 0;

  for (const binding of bindings) {
    try {
      const name: string = binding?.siteLabel?.value;
      const countryName: string = binding?.countryLabel?.value;
      const cityName: string = binding?.cityLabel?.value || countryName;
      const imageUrl: string | undefined = binding?.image?.value;
      const coordsRaw: string | undefined = binding?.coords?.value;

      if (!name || !countryName) { skipped++; continue; }

      const countryCode = nameToCode.get(countryName.toLowerCase());
      if (!countryCode) { skipped++; continue; }

      // Parse WKT Point(lng lat)
      let latitude: number | undefined, longitude: number | undefined;
      if (coordsRaw) {
        const match = coordsRaw.match(/Point\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/);
        if (match) {
          longitude = parseFloat(match[1]);
          latitude = parseFloat(match[2]);
        }
      }

      // Generate unique slug
      let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let slug = baseSlug;
      let counter = 2;
      while (slugsSeen.has(slug)) { slug = `${baseSlug}-${counter++}`; }
      slugsSeen.add(slug);

      const attraction = await prisma.attraction.upsert({
        where: { slug },
        update: {},
        create: { name, countryCode, city: cityName, slug, latitude, longitude },
      });

      if (imageUrl) {
        const photoCount = await prisma.photo.count({ where: { attractionId: attraction.id } });
        if (photoCount === 0) {
          await prisma.photo.create({
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
      console.error('[ERROR]', e?.message);
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
