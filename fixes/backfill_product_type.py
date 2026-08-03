"""
One-time backfill for games.product_type (added 20260803_007_add_product_type.sql).

Context: isStandaloneGame() drops ADD_ON_CONTENT hits *before*
algoliaHitToGameRow runs, so ongoing catalog sync can never label rows that
are already junk -- the column stays NULL forever for exactly the rows that
need labeling most. This script does the one-time classification pass via
Nintendo's own Algolia data.

Method (proven this session on ~500-row batches, scaled up here):
  - Algolia's nsuid FACET filter does not work on this index; searching by
    nsuid AS QUERY TEXT does, returning a small hit list to verify against.
  - Always confirm the returned hit's nsuid matches exactly before trusting
    it (Algolia's fuzzy search can return near-misses).
  - eshopDetails can come back a literal `null` for some hits (not just a
    missing key) -- fall back to topLevelFilters containing "DLC" or
    hasDlc=true in that case.
  - Rows with no nsuid at all (~119 as of 2026-08-03) can never be looked up
    this way -- most are pre-announcement placeholders or delisted listings.
    Try a title search as a weaker fallback; anything still unresolved after
    that gets 'UNKNOWN', a terminal state, not a value that alarms forever.

Safe to re-run: only ever touches rows where product_type IS NULL.
"""
import os, json, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

ENV_PATH = "/Users/huntcuttin/Documents/GitHub/blipd/.env.local"

def env(key):
    return os.popen(f"grep '^{key}=' {ENV_PATH} | cut -d= -f2-").read().strip()

SUPA_URL = env("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY")
ALGOLIA_APP_ID = "U3B6GR4UA3"
ALGOLIA_API_KEY = "a29c6927638bfd8cee23993e51e721c9"
ALGOLIA_URL = f"https://{ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/store_all_products_en_us/query"


def supa_req(path, method="GET", body=None):
    url = SUPA_URL + path
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None


def algolia_query(query_text, hits=5):
    body = json.dumps({"query": query_text, "hitsPerPage": hits}).encode()
    req = urllib.request.Request(
        ALGOLIA_URL, data=body, method="POST",
        headers={
            "X-Algolia-Application-Id": ALGOLIA_APP_ID,
            "X-Algolia-API-Key": ALGOLIA_API_KEY,
            "Content-Type": "application/json",
        },
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except Exception:
            # Broad on purpose: connection resets, timeouts, DNS hiccups, and
            # transient 5xx all land here. A single flaky request must never
            # crash the whole run (the first pass lost ~2000 lookups' worth
            # of work to one ConnectionResetError with a narrower except).
            if attempt == 3:
                return None
            time.sleep(1.0 * (attempt + 1))


def classify_by_nsuid(game):
    try:
        nsuid = game["nsuid"]
        data = algolia_query(nsuid)
        if not data:
            return {**game, "product_type": None, "reason": "algolia_error"}
        hits = data.get("hits", [])
        match = next((h for h in hits if h.get("nsuid") == nsuid), None)
        if not match:
            return {**game, "product_type": None, "reason": "no_exact_match"}
        eshop = match.get("eshopDetails") or {}
        pt = eshop.get("productType")
        if pt:
            return {**game, "product_type": pt, "reason": "eshopDetails"}
        # eshopDetails came back literal null for this hit -- fall back
        top_filters = match.get("topLevelFilters") or []
        if "DLC" in top_filters or match.get("hasDlc") is True:
            return {**game, "product_type": "ADD_ON_CONTENT", "reason": "topLevelFilters_fallback"}
        return {**game, "product_type": "TITLE", "reason": "assumed_title_no_dlc_signal"}
    except Exception as e:
        # Never let one row's unexpected shape kill the whole batch.
        return {**game, "product_type": None, "reason": f"exception:{e}"}


def classify_by_title(game):
    try:
        data = algolia_query(game["title"], hits=3)
        if not data:
            return {**game, "product_type": "UNKNOWN", "reason": "algolia_error_no_nsuid"}
        hits = data.get("hits", [])
        if not hits:
            return {**game, "product_type": "UNKNOWN", "reason": "no_title_match"}
        # No nsuid to verify against -- only trust a single, unambiguous hit
        if len(hits) == 1:
            eshop = hits[0].get("eshopDetails") or {}
            pt = eshop.get("productType")
            if pt:
                return {**game, "product_type": pt, "reason": "title_single_hit"}
        return {**game, "product_type": "UNKNOWN", "reason": "ambiguous_title_match"}
    except Exception as e:
        return {**game, "product_type": "UNKNOWN", "reason": f"exception:{e}"}


def fetch_null_games():
    rows = []
    page = 1000
    offset = 0
    while True:
        batch = supa_req(
            f"/rest/v1/games?select=id,nsuid,title&product_type=is.null&order=id&offset={offset}&limit={page}"
        )
        if not batch:
            break
        rows.extend(batch)
        offset += page
        if len(batch) < page:
            break
    return rows


def main():
    games = fetch_null_games()
    print(f"Rows needing backfill: {len(games)}")

    with_nsuid = [g for g in games if g.get("nsuid")]
    without_nsuid = [g for g in games if not g.get("nsuid")]
    print(f"  with nsuid (Algolia-lookupable): {len(with_nsuid)}")
    print(f"  without nsuid (title-fallback only): {len(without_nsuid)}")

    results = []
    with ThreadPoolExecutor(max_workers=15) as pool:
        futures = [pool.submit(classify_by_nsuid, g) for g in with_nsuid]
        for i, fut in enumerate(as_completed(futures)):
            results.append(fut.result())
            if (i + 1) % 200 == 0:
                print(f"  nsuid lookups: {i + 1}/{len(with_nsuid)}")

    with ThreadPoolExecutor(max_workers=15) as pool:
        futures = [pool.submit(classify_by_title, g) for g in without_nsuid]
        for i, fut in enumerate(as_completed(futures)):
            results.append(fut.result())
            if (i + 1) % 50 == 0:
                print(f"  title lookups: {i + 1}/{len(without_nsuid)}")

    # None product_type (transient Algolia errors) get UNKNOWN too -- terminal,
    # not left NULL to alarm forever. Re-run the script later if a large batch
    # of these appears at once (suggests Algolia was down, not real ambiguity).
    for r in results:
        if r["product_type"] is None:
            r["product_type"] = "UNKNOWN"

    from collections import Counter
    print("Classification summary:", dict(Counter(r["product_type"] for r in results)))

    # Checkpoint before writing -- if the DB write step fails partway, resume
    # from this file instead of re-querying Algolia for 2,750 rows again.
    checkpoint_path = "/tmp/backfill_product_type_results.json"
    with open(checkpoint_path, "w") as f:
        json.dump(results, f)
    print(f"Checkpoint written: {checkpoint_path}")

    # Write back in batches, grouped by product_type for compact PATCH bodies
    by_type = {}
    for r in results:
        by_type.setdefault(r["product_type"], []).append(r["id"])

    for ptype, ids in by_type.items():
        for i in range(0, len(ids), 200):
            chunk = ids[i:i + 200]
            id_list = ",".join(chunk)
            supa_req(
                f"/rest/v1/games?id=in.({id_list})",
                method="PATCH",
                body={"product_type": ptype},
            )
        print(f"  wrote product_type={ptype} to {len(ids)} rows")

    print("Done.")


if __name__ == "__main__":
    main()
