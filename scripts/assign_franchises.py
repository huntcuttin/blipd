#!/usr/bin/env python3
"""Franchise assignment script for Blippd games."""

import json
import re
import urllib.request
import urllib.error

BASE_URL = "https://cigsitwnhfnndtidrjjo.supabase.co/rest/v1"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZ3NpdHduaGZubmR0aWRyampvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY3NTc0NywiZXhwIjoyMDg4MjUxNzQ3fQ.joTo1qJF_kcZ-fgifkojs20u_HZDGZGElUcZ-gQPm6o"

HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def api_get(path):
    url = BASE_URL + path
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def api_patch(path, body):
    url = BASE_URL + path
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        print(f"  PATCH error {e.code}: {e.read()}")
        return e.code


def api_post(path, body, extra_prefer=None):
    url = BASE_URL + path
    data = json.dumps(body).encode()
    h = dict(HEADERS)
    if extra_prefer:
        h["Prefer"] = extra_prefer
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        print(f"  POST error {e.code}: {e.read()}")
        return e.code


def infer_franchise(title):
    t = title.lower()
    rules = [
        (lambda t: "zelda" in t or "link's awakening" in t or "hyrule" in t, "The Legend of Zelda"),
        (lambda t: "mario kart" in t, "Mario Kart"),
        (lambda t: "mario party" in t, "Mario Party"),
        (lambda t: "paper mario" in t, "Paper Mario"),
        (lambda t: "mario + rabbids" in t or "mario & rabbids" in t, "Mario + Rabbids"),
        (lambda t: "donkey kong" in t, "Donkey Kong"),
        (lambda t: "warioware" in t or "wario ware" in t, "WarioWare"),
        (lambda t: bool(re.search(r'\bwario\b', t)) and "warioware" not in t, "WarioWare"),
        (lambda t: "mario" in t, "Super Mario"),
        (lambda t: "pokemon" in t or "pok\u00e9mon" in t, "Pok\u00e9mon"),
        (lambda t: "kirby" in t, "Kirby"),
        (lambda t: "metroid" in t, "Metroid"),
        (lambda t: "pikmin" in t, "Pikmin"),
        (lambda t: "fire emblem" in t, "Fire Emblem"),
        (lambda t: "xenoblade" in t, "Xenoblade Chronicles"),
        (lambda t: "splatoon" in t, "Splatoon"),
        (lambda t: "animal crossing" in t and "animal well" not in t, "Animal Crossing"),
        (lambda t: "star fox" in t, "Star Fox"),
        (lambda t: "f-zero" in t, "F-Zero"),
        (lambda t: "yoshi" in t, "Yoshi"),
        (lambda t: "bayonetta" in t, "Bayonetta"),
        (lambda t: bool(re.search(r'\barms\b', t)) and not any(x in t for x in ["firearms","charms","farms","alarms","forearms","outstretched"]), "ARMS"),
        (lambda t: "smash bros" in t or "super smash" in t, "Super Smash Bros."),
        (lambda t: "astral chain" in t, "Astral Chain"),
        (lambda t: "sonic" in t, "Sonic the Hedgehog"),
        (lambda t: "mega man" in t or "megaman" in t, "Mega Man"),
        (lambda t: "castlevania" in t, "Castlevania"),
        (lambda t: "street fighter" in t, "Street Fighter"),
        (lambda t: "monster hunter" in t, "Monster Hunter"),
        (lambda t: "final fantasy" in t, "Final Fantasy"),
        (lambda t: "dragon quest" in t, "Dragon Quest"),
        (lambda t: "tales of" in t, "Tales Of"),
        (lambda t: bool(re.search(r'\bpersona\b', t)) and "personal" not in t and "personnel" not in t, "Persona"),
        (lambda t: "ace attorney" in t, "Ace Attorney"),
        (lambda t: "danganronpa" in t, "Danganronpa"),
        (lambda t: "shovel knight" in t, "Shovel Knight"),
        (lambda t: "hollow knight" in t, "Hollow Knight"),
        (lambda t: "dead cells" in t, "Dead Cells"),
        (lambda t: bool(re.search(r'\bhades\b', t)), "Hades"),
        (lambda t: "cuphead" in t, "Cuphead"),
        (lambda t: "stardew valley" in t, "Stardew Valley"),
        (lambda t: "terraria" in t, "Terraria"),
        (lambda t: "minecraft" in t, "Minecraft"),
        (lambda t: "among us" in t, "Among Us"),
        (lambda t: "fall guys" in t, "Fall Guys"),
        (lambda t: "fortnite" in t, "Fortnite"),
        (lambda t: "overwatch" in t, "Overwatch"),
        (lambda t: "diablo" in t and "diablos" not in t, "Diablo"),
        (lambda t: "dark souls" in t or "elden ring" in t or "sekiro" in t or "armored core" in t, "FromSoftware"),
        (lambda t: "witcher" in t, "The Witcher"),
        (lambda t: "cyberpunk" in t, "Cyberpunk"),
        (lambda t: "octopath traveler" in t, "Octopath Traveler"),
        (lambda t: "triangle strategy" in t, "Triangle Strategy"),
        (lambda t: "disco elysium" in t, "Disco Elysium"),
        (lambda t: "vampire survivors" in t, "Vampire Survivors"),
        (lambda t: "dave the diver" in t, "Dave the Diver"),
        (lambda t: bool(re.search(r'\bceleste\b', t)), "Celeste"),
        (lambda t: bool(re.search(r'\bori\b', t)) and "omori" not in t and "memorial" not in t, "Ori"),
        (lambda t: "resident evil" in t, "Resident Evil"),
        (lambda t: "devil may cry" in t, "Devil May Cry"),
        (lambda t: "crash bandicoot" in t or "crash team racing" in t, "Crash Bandicoot"),
        (lambda t: "spyro" in t, "Spyro"),
        (lambda t: "rayman" in t, "Rayman"),
        (lambda t: "assassin's creed" in t or "assassins creed" in t, "Assassin's Creed"),
        (lambda t: "just dance" in t, "Just Dance"),
        (lambda t: "fitness boxing" in t or "ring fit" in t, "Fitness"),
        (lambda t: "nba 2k" in t, "NBA 2K"),
        (lambda t: "fifa" in t or "ea sports fc" in t, "EA Sports FC"),
        (lambda t: "cult of the lamb" in t, "Cult of the Lamb"),
        (lambda t: "no more heroes" in t or "travis strikes again" in t, "No More Heroes"),
        (lambda t: "little nightmares" in t, "Little Nightmares"),
        (lambda t: "overcooked" in t, "Overcooked"),
        (lambda t: "moving out" in t, "Moving Out"),
        (lambda t: "ai: the somnium" in t or "ai the somnium" in t, "AI: The Somnium Files"),
        (lambda t: "zero escape" in t or "nonary games" in t or "zero time dilemma" in t, "Zero Escape"),
        (lambda t: "steins;gate" in t or "steins gate" in t, "Steins;Gate"),
        (lambda t: "doki doki literature" in t, "Doki Doki Literature Club"),
        (lambda t: "streets of rage" in t, "Streets of Rage"),
        (lambda t: "castle crashers" in t, "Castle Crashers"),
        (lambda t: "bloodstained" in t, "Bloodstained"),
        (lambda t: "shantae" in t, "Shantae"),
        (lambda t: "axiom verge" in t, "Axiom Verge"),
        (lambda t: "contra" in t, "Contra"),
        (lambda t: "kingdom rush" in t, "Kingdom Rush"),
        (lambda t: "picross" in t, "Picross"),
        (lambda t: "pac-man" in t or "pac man" in t, "Pac-Man"),
        (lambda t: "batman" in t, "Batman"),
        (lambda t: "lego" in t, "LEGO"),
        (lambda t: "river city" in t, "River City"),
        (lambda t: "rogue legacy" in t, "Rogue Legacy"),
        (lambda t: "darkest dungeon" in t, "Darkest Dungeon"),
        (lambda t: "risk of rain" in t, "Risk of Rain"),
        (lambda t: "slay the spire" in t, "Slay the Spire"),
        (lambda t: "two point" in t, "Two Point"),
        (lambda t: "advance wars" in t, "Advance Wars"),
        (lambda t: "wargroove" in t, "Wargroove"),
        (lambda t: "bravely" in t, "Bravely"),
        (lambda t: "guacamelee" in t, "Guacamelee"),
        (lambda t: "atelier" in t, "Atelier"),
        (lambda t: bool(re.search(r'^ys[\s:,]', t)) or bool(re.search(r'\bys (i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|origin|seven|memories|foliage|lacrimosa|monstrum)\b', t)), "Ys"),
        (lambda t: "rune factory" in t, "Rune Factory"),
        (lambda t: "story of seasons" in t or "harvest moon" in t, "Story of Seasons"),
        (lambda t: "eiyuden chronicle" in t, "Eiyuden Chronicle"),
        (lambda t: "unicorn overlord" in t, "Unicorn Overlord"),
        (lambda t: "famicom detective" in t, "Famicom Detective Club"),
        (lambda t: "fashion dreamer" in t, "Fashion Dreamer"),
        (lambda t: "luigi's mansion" in t, "Luigi's Mansion"),
        (lambda t: "miitopia" in t, "Miitopia"),
    ]
    for check, franchise in rules:
        try:
            if check(t):
                return franchise
        except Exception:
            pass
    return None


def fetch_all_unfranchised():
    """Fetch all unfranchised games using pagination."""
    all_games = []
    offset = 0
    page_size = 1000
    while True:
        path = (
            f"/games?select=id,title&franchise=is.null&is_suppressed=eq.false"
            f"&order=created_at.desc&limit={page_size}&offset={offset}"
        )
        page = api_get(path)
        if not page:
            break
        all_games.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return all_games


def main():
    print("=== Blippd Franchise Assignment ===\n")

    # Step 1: Fetch unfranchised games (paginated)
    print("Step 1: Fetching unfranchised games...")
    games = fetch_all_unfranchised()
    print(f"  Found {len(games)} unfranchised games\n")

    # Step 2 & 3: Infer and update
    print("Step 2+3: Inferring and updating franchises...")
    matched = 0
    franchise_counts = {}
    newly_assigned_franchises = set()

    for game in games:
        franchise = infer_franchise(game["title"])
        if franchise:
            status = api_patch(f"/games?id=eq.{game['id']}", {"franchise": franchise})
            if status in (200, 204):
                matched += 1
                franchise_counts[franchise] = franchise_counts.get(franchise, 0) + 1
                newly_assigned_franchises.add(franchise)
                print(f"  [OK] {game['title']!r} -> {franchise}")
            else:
                print(f"  [FAIL] {game['title']!r} -> {franchise} (status {status})")

    print(f"\n  Matched {matched}/{len(games)} games\n")

    # Step 4: Ensure franchise records exist
    print("Step 4: Fetching existing franchise records...")
    existing_raw = api_get("/franchises?select=id,name&limit=500")
    existing_names_lower = {f["name"].lower(): f["name"] for f in existing_raw}
    print(f"  Found {len(existing_raw)} existing franchises")

    new_franchise_records = 0
    for fname in sorted(newly_assigned_franchises):
        if fname.lower() not in existing_names_lower:
            status = api_post(
                "/franchises",
                {"name": fname, "game_count": 1, "logo": ""},
                extra_prefer="resolution=ignore-duplicates,return=minimal",
            )
            if status in (200, 201, 204):
                new_franchise_records += 1
                print(f"  [CREATED] Franchise: {fname!r}")
            else:
                print(f"  [SKIP/ERR] Franchise: {fname!r} (status {status})")
        else:
            print(f"  [EXISTS] {fname!r}")

    # Step 5: Orphan check — franchises in games table not in franchises table
    print("\nStep 5: Orphan franchise check...")
    all_game_franchises_raw = api_get(
        "/games?select=franchise&franchise=not.is.null&franchise=neq.&limit=2000"
    )
    unique_game_franchises = set(
        r["franchise"] for r in all_game_franchises_raw if r.get("franchise")
    )

    orphans_created = 0
    for fname in sorted(unique_game_franchises):
        if fname.lower() not in existing_names_lower and fname not in newly_assigned_franchises:
            status = api_post(
                "/franchises",
                {"name": fname, "game_count": 1, "logo": ""},
                extra_prefer="resolution=ignore-duplicates,return=minimal",
            )
            if status in (200, 201, 204):
                orphans_created += 1
                print(f"  [ORPHAN FIXED] {fname!r}")
            else:
                print(f"  [ORPHAN ERR] {fname!r} (status {status})")

    if orphans_created == 0:
        print("  No orphaned franchises found.")

    # Step 6: Report
    print("\n=== REPORT ===")
    print(f"Total unfranchised games checked : {len(games)}")
    print(f"Games matched and updated        : {matched}")
    print(f"Games without a match            : {len(games) - matched}")
    print(f"New franchise records created    : {new_franchise_records}")
    print(f"Orphan franchise records fixed   : {orphans_created}")
    print("\nBreakdown by franchise:")
    for fname, count in sorted(franchise_counts.items(), key=lambda x: -x[1]):
        print(f"  {fname:<35} {count}")


if __name__ == "__main__":
    main()
