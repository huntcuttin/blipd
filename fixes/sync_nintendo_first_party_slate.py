"""
One-off reconciliation of Nintendo's recent first-party release slate
(founder-supplied from Nintendo's own "New releases" listing, 2026-08-05)
against our catalog. Our rows for these were stale or missing: Rhythm
Heaven Groove sat on the TBA placeholder despite shipping 7/2/26, Star
Fox (6/25/26), Pokemon Champions (4/8/26) etc. -- the catalog sync's
long-broken existence check (fixed 2026-08-04) plus the "(English) ..."
language-prefix filter kept several from ever getting correct data.

For each title: look up Nintendo's own Algolia record (same index the
catalog sync uses), take THEIR release date/nsuid/price/cover, and
upsert into our games table with release_date_source='nintendo' (the
same source value ingest itself uses for Nintendo-provided dates, so
future syncs agree rather than fight). Titles Algolia can't confirm are
reported, not guessed.

The "(English) Pokemon FireRed/LeafGreen" pair: ingest's language-prefix
filter (isEnglishGame) permanently excludes any "(NNN) "-prefixed title
as a language variant, so these two legitimate releases can never enter
via sync -- inserted here with the prefix stripped for display; sync
won't duplicate them since it keeps filtering the prefixed originals.

Safe to re-run: keyed on nsuid, updates in place.
"""
import os, json, re, time, unicodedata, urllib.request
from datetime import date

ENV_PATH = "/Users/huntcuttin/Documents/GitHub/blipd/.env.local"

def env(key):
    return os.popen(f"grep '^{key}=' {ENV_PATH} | cut -d= -f2-").read().strip()

SUPA = env("NEXT_PUBLIC_SUPABASE_URL")
KEY = env("SUPABASE_SERVICE_ROLE_KEY")
ALGOLIA_APP = "U3B6GR4UA3"
ALGOLIA_KEY = "a29c6927638bfd8cee23993e51e721c9"
ALGOLIA_URL = f"https://{ALGOLIA_APP}-dsn.algolia.net/1/indexes/store_all_products_en_us/query"

# Founder-supplied slate: (search title, expected release date YYYY-MM-DD)
SLATE = [
    ("Xenoblade Chronicles 2 - Nintendo Switch 2 Edition", "2026-07-30"),
    ("Splatoon Raiders", "2026-07-23"),
    ("Fitness Boxing 3: Your Personal Trainer - Nintendo Switch 2 Edition", "2026-07-16"),
    ("Rhythm Heaven Groove", "2026-07-02"),
    ("Star Fox", "2026-06-25"),
    ("Yoshi and the Mysterious Book", "2026-05-21"),
    ("Tomodachi Life: Living the Dream", "2026-04-16"),
    ("Pokemon Champions", "2026-04-08"),
    ("Super Mario Bros. Wonder - Nintendo Switch 2 Edition", "2026-03-26"),
    ("Pokemon Pokopia", "2026-03-05"),
    ("Xenoblade Chronicles X: Definitive Edition - Nintendo Switch 2 Edition", "2026-02-19"),
    ("(English) Pokemon FireRed Version", "2026-02-27"),
    ("(English) Pokemon LeafGreen Version", "2026-02-27"),
    ("Mario Tennis Fever", "2026-02-12"),
    # Upcoming slate (founder-supplied 2026-08-05). Year-only listings use
    # the Dec-31 sentinel encoding (isYearOnlyDate convention).
    ("Fire Emblem: Fortune's Weave", "2026-09-17"),
    ("Fire Emblem: Fortune's Weave Dagdan Collection", "2026-09-17"),
    ("Nintendo Switch Sports Resort", "2026-10-22"),
    ("Xenoblade Chronicles 3 - Nintendo Switch 2 Edition", "2026-12-03"),
    ("The Legend of Zelda: Ocarina of Time", "2026-12-31"),
    ("Xenoblade Genesis", "2027-12-31"),
    ("Pokemon Winds", "2027-12-31"),
    ("Pokemon Waves", "2027-12-31"),
]

def supa(path, method="GET", body=None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(SUPA + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None

def algolia(query):
    body = json.dumps({"query": query, "hitsPerPage": 8}).encode()
    req = urllib.request.Request(ALGOLIA_URL, data=body, method="POST", headers={
        "X-Algolia-Application-Id": ALGOLIA_APP, "X-Algolia-API-Key": ALGOLIA_KEY, "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r).get("hits", [])

def norm(s):
    # Trademark strip must run BEFORE NFKD: compatibility decomposition
    # turns the single ™ codepoint into the letters "TM" glued to the word
    # ("Splatoon™" -> "splatoontm"), which broke every ™-carrying match on
    # the run that added accent folding.
    s = re.sub(r"[™®©]", "", s)
    # Accent folding: "Pokemon" (search term) must match "Pokémon".
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[‘’`´]", "'", s)
    s = re.sub(r"^\((English)\)\s*", "", s, flags=re.I)
    s = re.sub(r"\s*[-–—:+]\s*", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.lower().strip()

def slugify(title):
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", title.lower()))

def main():
    today = date.today().isoformat()
    fixed, created, missing = [], [], []

    for search_title, expected_date in SLATE:
        hits = algolia(search_title)
        target = norm(search_title)
        hit = next((h for h in hits if norm(h.get("title", "")) == target), None)
        if not hit:
            hit = next((h for h in hits if norm(h.get("title", "")).startswith(target) or target.startswith(norm(h.get("title", "")))), None)
        if not hit or not hit.get("nsuid"):
            missing.append(search_title)
            continue

        nsuid = hit["nsuid"]
        # Nintendo's own date wins when Algolia carries one; the founder's
        # listed date is the crosscheck. releaseDate is ISO with time.
        algolia_date = (hit.get("releaseDate") or "")[:10] or expected_date
        if algolia_date != expected_date:
            print(f"  note: {search_title}: Algolia says {algolia_date}, listing said {expected_date} -- using Algolia's")
        display_title = re.sub(r"^\(English\)\s*", "", hit["title"])
        msrp = hit.get("msrp") or 0
        status = "released" if algolia_date <= today else "upcoming"

        # Match by nsuid first, then by slug -- several slate games predate
        # this fix as manually-added rows with nsuid null (e.g. "Yoshi and
        # the Mysterious Book"), which an nsuid-only lookup misses and the
        # subsequent insert then 409s on the slug unique constraint.
        slug = slugify(display_title)
        existing = supa(f"/rest/v1/games?select=id,title,release_date,release_status,is_suppressed&nsuid=eq.{nsuid}")
        if not existing:
            existing = supa(f"/rest/v1/games?select=id,title,release_date,release_status,is_suppressed&slug=eq.{slug}")
        payload = {
            "nsuid": nsuid,
            "release_date": algolia_date,
            "release_status": status,
            "release_date_source": "nintendo",
            "is_suppressed": False,
            "product_type": "TITLE",
        }
        if existing:
            supa(f"/rest/v1/games?id=eq.{existing[0]['id']}", "PATCH", payload)
            fixed.append((display_title, existing[0]["release_date"], algolia_date))
        else:
            row = {
                **payload,
                "nsuid": nsuid,
                "title": display_title,
                "slug": slugify(display_title),
                "publisher": hit.get("softwarePublisher") or "Nintendo",
                "cover_art": hit.get("productImage") and f"https://assets.nintendo.com/image/upload/{hit['productImage']}" or "",
                "current_price": msrp,
                "original_price": msrp,
                "discount": 0,
                "is_on_sale": False,
                "is_all_time_low": False,
                "platform": hit.get("platform") or "Nintendo Switch 2",
                "price_history": [],
            }
            supa("/rest/v1/games", "POST", row)
            created.append((display_title, algolia_date))
        time.sleep(0.15)

    print(f"\nUpdated existing: {len(fixed)}")
    for t, old, new in fixed:
        print(f"  {t[:60]}: {old} -> {new}")
    print(f"Created: {len(created)}")
    for t, d in created:
        print(f"  {t[:60]}: {d}")
    if missing:
        print(f"NOT FOUND in Algolia (left alone): {missing}")

if __name__ == "__main__":
    main()
