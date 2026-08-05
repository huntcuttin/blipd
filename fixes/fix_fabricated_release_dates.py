"""
One-off fix for released games carrying provably fabricated release dates
(found 2026-08-04 during the overnight UI loop, via a live screenshot of
Monster Hunter Generations Ultimate claiming "Released July 25, 2026").

Defining condition: a released, unsuppressed game whose EARLIEST price-type
alert (price_drop / sale_started / sale_ending / all_time_low -- types that
require the game to be purchasable, unlike announcement types which can
legitimately predate release) is more than 30 days BEFORE its recorded
release_date. A price alert cannot precede a game's release, so any such
date is fabricated -- these are the release_date_source='unknown' siblings
of the 499-row "released today" incident (see CLAUDE.md session log
2026-08-03), stamped by the old pricedUpcoming guess-today code on
whatever day the repoll rotation reached each game. The earlier cleanup
only reverted 'price-confirmed'-tagged rows; this class (236 rows at time
of writing) was invisible to it.

Fix per game: resolve the real date via IGDB using the exact same
search/normalize/match logic as src/lib/igdb.ts (normalizeForMatch +
pickBestMatch, platforms 130,508). Matched -> real date + source='igdb'
(protected by catalog sync's trusted-source restore). Unmatched -> the
2099-12-31 placeholder + source='igdb-no-match' so sync-release-dates'
retry lane keeps attempting it without jamming the fresh queue.

Safe to re-run: the defining condition self-limits to still-wrong rows.
"""
import os, json, re, time, urllib.request, urllib.error
from datetime import date
from concurrent.futures import ThreadPoolExecutor, as_completed

ENV_PATH = "/Users/huntcuttin/Documents/GitHub/blipd/.env.local"

def env(key):
    return os.popen(f"grep '^{key}=' {ENV_PATH} | cut -d= -f2-").read().strip()

SUPA = env("NEXT_PUBLIC_SUPABASE_URL")
KEY = env("SUPABASE_SERVICE_ROLE_KEY")
TWITCH_ID = env("TWITCH_CLIENT_ID")
TWITCH_SECRET = env("TWITCH_CLIENT_SECRET")
PLATFORMS = "130,508"

def supa(path, method="GET", body=None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(SUPA + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None

def get_igdb_token():
    req = urllib.request.Request(
        f"https://id.twitch.tv/oauth2/token?client_id={TWITCH_ID}&client_secret={TWITCH_SECRET}&grant_type=client_credentials",
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)["access_token"]

def strip_trademarks(s):
    return re.sub(r"[™®©]", "", s)

def normalize_for_match(s):
    s = strip_trademarks(s)
    s = re.sub(r"[‘’`´]", "'", s)
    s = re.sub(r'[“”]', '"', s)
    s = re.sub(r"\s*[-–—:]\s*", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.lower().strip()

def pick_best_match(games, search_name):
    ns = normalize_for_match(search_name)
    for g in games:
        if normalize_for_match(g["name"]) == ns:
            return g
    for g in games:
        n = normalize_for_match(g["name"])
        if n.startswith(ns) or ns.startswith(n):
            return g
    return games[0] if len(games) == 1 else None

def igdb(endpoint, body, token):
    req = urllib.request.Request(
        f"https://api.igdb.com/v4/{endpoint}",
        data=body.encode(),
        headers={"Client-ID": TWITCH_ID, "Authorization": f"Bearer {token}", "Content-Type": "text/plain"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)

def resolve_date(title, token):
    for attempt_name in dict.fromkeys([title, strip_trademarks(title)]):
        try:
            escaped = attempt_name.replace('"', '\\"')
            games = igdb("games", f'search "{escaped}"; fields name,id; where platforms = ({PLATFORMS}); limit 5;', token)
            if not games:
                continue
            best = pick_best_match(games, attempt_name)
            if not best:
                continue
            # Earliest across platforms -- an arbitrary limit-1 pick returned
            # Switch 2 Edition / re-release dates for long-out games on the
            # first run (DRAGON QUEST XI S "resolved" to its 2026 re-release
            # and flipped back to upcoming), same flaw fixed in src/lib/igdb.ts.
            rds = igdb("release_dates", f"fields date; where game = {best['id']} & platform = ({PLATFORMS}) & date != null; sort date asc; limit 10;", token)
            if rds and rds[0].get("date"):
                return time.strftime("%Y-%m-%d", time.gmtime(rds[0]["date"]))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2)
            continue
        except Exception:
            continue
    return None

def find_fabricated():
    games, offset = [], 0
    while True:
        b = supa(f"/rest/v1/games?select=id,title,release_date&release_status=eq.released&is_suppressed=eq.false&release_date=not.in.(2099-12-31,2020-01-01)&order=id&offset={offset}&limit=1000")
        games.extend(b)
        if len(b) < 1000:
            break
        offset += 1000
    alerts, offset = [], 0
    while True:
        b = supa(f"/rest/v1/alerts?select=game_id,created_at&type=in.(price_drop,sale_started,sale_ending,all_time_low)&order=created_at.asc&offset={offset}&limit=1000")
        alerts.extend(b)
        if len(b) < 1000:
            break
        offset += 1000
    earliest = {}
    for a in alerts:
        earliest.setdefault(a["game_id"], a["created_at"][:10])
    bad = []
    for g in games:
        e = earliest.get(g["id"])
        if e and (date.fromisoformat(g["release_date"]) - date.fromisoformat(e)).days > 30:
            bad.append(g)
    return bad

def main():
    bad = find_fabricated()
    print(f"Fabricated-date rows: {len(bad)}")
    if not bad:
        return
    token = get_igdb_token()

    resolved, unresolved = [], []
    # IGDB free tier allows 4 req/s; each resolve is 2-4 requests, so 2
    # workers with a small stagger stays safely under it.
    with ThreadPoolExecutor(max_workers=2) as pool:
        futs = {pool.submit(resolve_date, g["title"], token): g for g in bad}
        for i, fut in enumerate(as_completed(futs)):
            g = futs[fut]
            d = fut.result()
            if d:
                resolved.append((g, d))
            else:
                unresolved.append(g)
            if (i + 1) % 25 == 0:
                print(f"  {i + 1}/{len(bad)} looked up")

    print(f"IGDB resolved: {len(resolved)}, unresolved: {len(unresolved)}")

    today = date.today().isoformat()
    for g, d in resolved:
        status = "released" if d <= today else "upcoming"
        supa(f"/rest/v1/games?id=eq.{g['id']}", "PATCH", {
            "release_date": d, "release_status": status, "release_date_source": "igdb",
        })
    for g in unresolved:
        supa(f"/rest/v1/games?id=eq.{g['id']}", "PATCH", {
            "release_date": "2099-12-31", "release_date_source": "igdb-no-match",
        })
    print("Done. Examples of corrections:")
    for g, d in resolved[:10]:
        print(f"  {g['title'][:55]}: {g['release_date']} -> {d}")

if __name__ == "__main__":
    main()
