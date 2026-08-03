import re
import os, json, urllib.request, math
from collections import defaultdict

SUPA_URL = os.popen("grep '^NEXT_PUBLIC_SUPABASE_URL=' /Users/huntcuttin/Documents/GitHub/blipd/.env.local | cut -d= -f2-").read().strip()
KEY = os.popen("grep '^SUPABASE_SERVICE_ROLE_KEY=' /Users/huntcuttin/Documents/GitHub/blipd/.env.local | cut -d= -f2-").read().strip()

def req(path, method="GET", body=None, headers=None):
    url = SUPA_URL + path
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if headers: h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read() or b"null")

# Fetch all alerts, paginated
rows = []
page = 1000
i = 0
while True:
    batch = req(f"/rest/v1/alerts?select=id,game_id,type,created_at&order=created_at.asc&offset={i}&limit={page}")
    if not batch: break
    rows.extend(batch)
    i += page
    if len(batch) < page: break

print(f"Fetched {len(rows)} alerts")

groups = defaultdict(list)
for r in rows:
    # created_at like 2026-03-07T12:34:56.789+00:00 -> parse epoch via fromisoformat
    ts = r["created_at"].replace("Z", "+00:00")
    m = re.match(r"(.*T\d{2}:\d{2}:\d{2})(\.\d+)?([+-]\d{2}:\d{2})", ts)
    base, frac, tz = m.group(1), m.group(2) or "", m.group(3)
    frac = (frac[1:] + "000000")[:6] if frac else "000000"
    from datetime import datetime
    dt = datetime.fromisoformat(f"{base}.{frac}{tz}")
    epoch = dt.timestamp()
    day_bucket = math.floor(epoch / 86400)
    key = (r["game_id"], r["type"], day_bucket)
    groups[key].append(r)

dupe_ids = []
dupe_groups = 0
for key, items in groups.items():
    if len(items) > 1:
        dupe_groups += 1
        # items already sorted by created_at asc (query order) — keep first, delete rest
        for extra in items[1:]:
            dupe_ids.append(extra["id"])

print(f"Duplicate groups: {dupe_groups}, rows to delete: {len(dupe_ids)}")
with open("/private/tmp/claude-501/-Users-huntcuttin-Documents-GitHub-blipd/07481d51-272c-4559-b02c-4f65aed016b6/scratchpad/dupe_ids.json", "w") as f:
    json.dump(dupe_ids, f)
