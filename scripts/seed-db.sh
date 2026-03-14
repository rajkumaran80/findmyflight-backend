#!/usr/bin/env bash
# =============================================================
# seed-db.sh — Run the Prisma seed against local or prod DB
#
# Usage:
#   ./scripts/seed-db.sh              # uses DATABASE_URL from .env
#   ./scripts/seed-db.sh prod         # prompts before seeding prod
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

ENV="${1:-local}"

# ── Load .env for local ──────────────────────────────────────
if [[ "$ENV" == "local" ]]; then
  if [[ -f "$ROOT/.env" ]]; then
    set -a
    source "$ROOT/.env"
    set +a
    echo "Loaded .env"
  else
    echo "ERROR: .env not found at $ROOT/.env"
    exit 1
  fi
fi

# ── Prod guard ───────────────────────────────────────────────
if [[ "$ENV" == "prod" ]]; then
  echo ""
  echo "WARNING: You are about to seed the PRODUCTION database."
  echo "DATABASE_URL = ${DATABASE_URL:-not set}"
  echo ""
  read -r -p "Type 'yes' to continue: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

cd "$ROOT"

# ── Run migrations first (safe — skips already-applied) ─────
echo ""
echo "==> Running pending migrations..."
npx prisma migrate deploy

# ── Run seed ─────────────────────────────────────────────────
echo ""
echo "==> Seeding countries and cities..."
npx ts-node --project tsconfig.json prisma/seed.ts

echo ""
echo "==> Seeding airports..."
npx ts-node --project tsconfig.json scripts/seed-airports.ts

echo ""
echo "==> Importing attractions..."
if [[ -f "$ROOT/attractions.json" ]]; then
  npx ts-node --project tsconfig.json scripts/import-attractions.ts
else
  echo "attractions.json not found — skipping"
fi

echo ""
echo "Done. Seed complete."
