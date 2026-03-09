// IGDB API client for fetching real release dates
// Requires TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET env vars
// Free tier: 4 requests/sec

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getIGDBToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set");
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!res.ok) {
    throw new Error(`Twitch OAuth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

function stripTrademarks(name: string): string {
  return name.replace(/[™®©]/g, "").trim();
}

// IGDB platform ID for Nintendo Switch
const SWITCH_PLATFORM_ID = 130;

interface IGDBReleaseDateResult {
  releaseDate: string; // ISO date string YYYY-MM-DD
  igdbId: number;
  matchedName: string;
}

interface IGDBHypeResult {
  igdbId: number;
  hypes: number;
  matchedName: string;
}

export async function getIGDBReleaseDate(
  gameName: string
): Promise<IGDBReleaseDateResult | null> {
  const token = await getIGDBToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;

  // Try exact match first, then stripped match
  const attempts = [gameName, stripTrademarks(gameName)];
  const seen = new Set<string>();

  for (const searchName of attempts) {
    if (seen.has(searchName)) continue;
    seen.add(searchName);

    const result = await searchIGDB(searchName, token, clientId);
    if (result) return result;
  }

  return null;
}

async function searchIGDB(
  searchName: string,
  token: string,
  clientId: string
): Promise<IGDBReleaseDateResult | null> {
  // Search for the game
  const searchRes = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: `search "${searchName.replace(/"/g, '\\"')}"; fields name,id; where platforms = (${SWITCH_PLATFORM_ID}); limit 5;`,
  });

  if (!searchRes.ok) {
    if (searchRes.status === 429) {
      console.warn("IGDB rate limit hit, backing off");
      await sleep(1000);
      return null;
    }
    console.error(`IGDB search failed: ${searchRes.status}`);
    return null;
  }

  const games = await searchRes.json();
  if (!games || games.length === 0) return null;

  // Find best match
  const normalizedSearch = searchName.toLowerCase().trim();
  let bestMatch = games.find(
    (g: { name: string }) => g.name.toLowerCase().trim() === normalizedSearch
  );

  // If no exact match but only one result, use it
  if (!bestMatch && games.length === 1) {
    bestMatch = games[0];
  }

  if (!bestMatch) return null;

  // Get release date for Switch platform
  const rdRes = await fetch("https://api.igdb.com/v4/release_dates", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: `fields date,platform,human; where game = ${bestMatch.id} & platform = ${SWITCH_PLATFORM_ID}; limit 1;`,
  });

  if (!rdRes.ok) return null;

  const releaseDates = await rdRes.json();
  if (!releaseDates || releaseDates.length === 0 || !releaseDates[0].date) {
    return null;
  }

  // IGDB returns Unix timestamp in seconds
  const dateObj = new Date(releaseDates[0].date * 1000);
  const isoDate = dateObj.toISOString().split("T")[0];

  return {
    releaseDate: isoDate,
    igdbId: bestMatch.id,
    matchedName: bestMatch.name,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch hype count for a game by IGDB ID or name search
export async function getIGDBHype(
  gameName: string,
  existingIgdbId?: number | null
): Promise<IGDBHypeResult | null> {
  const token = await getIGDBToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;

  const igdbId = existingIgdbId;
  const matchedName = gameName;

  // If we don't have an IGDB ID, search for the game
  if (!igdbId) {
    const searchRes = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `search "${gameName.replace(/"/g, '\\"')}"; fields name,id,hypes; where platforms = (${SWITCH_PLATFORM_ID}); limit 5;`,
    });

    if (!searchRes.ok) {
      if (searchRes.status === 429) await sleep(1000);
      return null;
    }

    const games = await searchRes.json();
    if (!games || games.length === 0) return null;

    const normalizedSearch = gameName.toLowerCase().trim();
    const bestMatch =
      games.find((g: { name: string }) => g.name.toLowerCase().trim() === normalizedSearch) ??
      (games.length === 1 ? games[0] : null);

    if (!bestMatch) return null;

    return {
      igdbId: bestMatch.id,
      hypes: bestMatch.hypes ?? 0,
      matchedName: bestMatch.name,
    };
  }

  // We have an IGDB ID — fetch directly
  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: `fields name,hypes; where id = ${igdbId}; limit 1;`,
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!data || data.length === 0) return null;

  return {
    igdbId,
    hypes: data[0].hypes ?? 0,
    matchedName: data[0].name ?? matchedName,
  };
}

// Batch fetch hype scores for multiple games
export async function batchGetHypeScores(
  games: { id: string; title: string; igdbId?: number | null }[]
): Promise<Map<string, { igdbId: number; hypes: number }>> {
  const results = new Map<string, { igdbId: number; hypes: number }>();

  for (const game of games) {
    try {
      const result = await getIGDBHype(game.title, game.igdbId);
      if (result && result.hypes > 0) {
        results.set(game.id, { igdbId: result.igdbId, hypes: result.hypes });
        console.log(`  IGDB hype: "${game.title}" → ${result.hypes} hypes`);
      }
    } catch (err) {
      console.error(`  IGDB hype error for "${game.title}":`, err);
    }

    await sleep(500);
  }

  return results;
}

// Rate-limited batch processor: 4 req/sec = 250ms between calls
// Each game does 2 API calls (search + release_dates), so 500ms per game
export async function batchGetReleaseDates(
  games: { id: string; title: string }[]
): Promise<Map<string, { releaseDate: string; matchedName: string }>> {
  const results = new Map<string, { releaseDate: string; matchedName: string }>();

  for (const game of games) {
    try {
      const result = await getIGDBReleaseDate(game.title);
      if (result) {
        results.set(game.id, {
          releaseDate: result.releaseDate,
          matchedName: result.matchedName,
        });
        console.log(`  IGDB match: "${game.title}" → "${result.matchedName}" (${result.releaseDate})`);
      } else {
        console.log(`  IGDB no match: "${game.title}"`);
      }
    } catch (err) {
      console.error(`  IGDB error for "${game.title}":`, err);
    }

    // Rate limit: ~2 API calls per game, 4 req/sec max → 500ms between games
    await sleep(500);
  }

  return results;
}
