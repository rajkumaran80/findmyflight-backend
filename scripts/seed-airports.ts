import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../node_modules/prisma-client';

const prisma = new PrismaClient();

// Resolve CSV path — try frontend public folder first, then local
function findCsv(): string {
  const candidates = [
    path.join(__dirname, '../../findmyflight-frontend/public/airports.csv'),
    path.join(__dirname, '../airports.csv'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('airports.csv not found. Tried:\n' + candidates.join('\n'));
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  const len = line.length;
  while (i <= len) {
    if (i === len) { fields.push(''); break; }
    if (line[i] === '"') {
      const end = line.indexOf('"', i + 1);
      if (end === -1) { fields.push(line.slice(i + 1)); break; }
      fields.push(line.slice(i + 1, end));
      i = end + 2;
    } else {
      const next = line.indexOf(',', i);
      if (next === -1) { fields.push(line.slice(i)); break; }
      fields.push(line.slice(i, next));
      i = next + 1;
    }
  }
  return fields;
}

async function main() {
  const csvPath = findCsv();
  console.log(`Reading CSV from: ${csvPath}`);

  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.split('\n').slice(1); // skip header

  const seen = new Set<string>();
  const airports: {
    iataCode: string; icaoCode?: string; name: string; city: string;
    countryCode: string; type?: string; latitude?: number; longitude?: number; keywords?: string;
  }[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const f = parseLine(line);
      const iataCode = f[13]?.trim();
      if (!iataCode || iataCode.length !== 3 || seen.has(iataCode)) continue;

      const type = f[2]?.trim();
      // Only keep large and medium airports to keep the table lean (~4,000 rows)
      if (type !== 'large_airport' && type !== 'medium_airport') continue;

      airports.push({
        iataCode: iataCode.toUpperCase(),
        icaoCode: f[12]?.trim() || undefined,
        name: f[3]?.trim() || iataCode,
        city: f[10]?.trim() || '',
        countryCode: f[8]?.trim() || '',
        type,
        latitude: f[4] ? parseFloat(f[4]) : undefined,
        longitude: f[5] ? parseFloat(f[5]) : undefined,
        keywords: f[18]?.trim() || undefined,
      });
      seen.add(iataCode);
    } catch {
      continue;
    }
  }

  console.log(`Parsed ${airports.length} airports (large + medium with IATA codes)`);

  let inserted = 0, skipped = 0;
  for (const airport of airports) {
    await prisma.airport.upsert({
      where: { iataCode: airport.iataCode },
      update: {},
      create: airport,
    });
    inserted++;
  }

  console.log(`Done: ${inserted} upserted, ${skipped} skipped`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
