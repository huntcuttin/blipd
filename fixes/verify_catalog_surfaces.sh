#!/usr/bin/env bash
# Runs the same filter conditions as the three real user-facing catalog
# queries (Out Now / Coming Soon / Deals) directly against the live
# Supabase REST API and prints the top 20 titles for each -- the "eyeball
# the top 20" check the change-discipline rules (docs/AUDIT-2026-08-03.md
# §F) ask for after any edit touching a shared catalog signal
# (is_suppressed, product_type, release_date semantics/placeholders).
#
# This is a bash approximation of the real TypeScript queries, not a literal
# re-execution of them -- it replicates each query's filter/order clauses
# via the same REST API the app itself uses, but does NOT replicate
# getRecentReleases/getUpcomingGamesSoon's client-side Nintendo-first
# re-sort (JS-side, not expressible as a single REST filter). Good enough
# for the actual purpose: "did junk leak back in," not exact production
# ordering.
#
# Usage: fixes/verify_catalog_surfaces.sh
# Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
SUPA_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2-)

if [ -z "$SUPA_URL" ] || [ -z "$KEY" ]; then
  echo "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in $ENV_FILE" >&2
  exit 1
fi

NOT_JUNK_OR="product_type.is.null,product_type.not.in.(ADD_ON_CONTENT,BUNDLE)"
THIRTY_DAYS_AGO=$(python3 -c "import datetime; print((datetime.date.today()-datetime.timedelta(days=30)).isoformat())")
TODAY=$(python3 -c "import datetime; print(datetime.date.today().isoformat())")

query() {
  local desc="$1"; shift
  local url="$SUPA_URL/rest/v1/games?$1"
  echo "=== $desc ==="
  curl -s "$url" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    | python3 -c "
import json, sys
rows = json.load(sys.stdin)
if not rows:
    print('  (0 rows)')
for r in rows[:20]:
    print(f\"  {r.get('title','?')}  [{r.get('product_type')}, {r.get('release_date')}]\")
print(f'  ... {len(rows)} total fetched (capped by this script\\'s own limit, not necessarily the real query\\'s)')
"
  echo
}

echo "Verifying live catalog surfaces against product_type/is_suppressed/placeholder-date filters"
echo "(faithful to src/lib/queries.ts and src/app/deals/page.tsx as of the 2026-08-03 audit)"
echo

query "Out Now (getRecentReleases)" \
  "select=title,product_type,release_date&release_status=eq.released&is_suppressed=eq.false&or=($NOT_JUNK_OR)&release_date=gte.$THIRTY_DAYS_AGO&release_date=neq.2099-12-31&release_date=neq.2020-01-01&original_price=gt.0&order=release_date.desc&limit=100"

query "Coming Soon (getUpcomingGamesSoon)" \
  "select=title,product_type,release_date&release_status=in.(upcoming,out_today)&is_suppressed=eq.false&or=($NOT_JUNK_OR)&release_date=gte.$TODAY&release_date=neq.2099-12-31&order=release_date.asc&limit=200"

query "Deals (/deals SSR + getGamesOnSale)" \
  "select=title,product_type,discount,release_date&is_on_sale=eq.true&is_suppressed=eq.false&or=($NOT_JUNK_OR)&order=discount.desc&limit=200"

echo "Done. Eyeball the above for anything that reads as junk (DLC/costume/song/bundle items) before committing a catalog-affecting change."
