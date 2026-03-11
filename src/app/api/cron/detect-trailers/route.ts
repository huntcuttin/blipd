import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/nintendo/admin-client";

export const runtime = "nodejs";
export const maxDuration = 60;

const NINTENDO_CHANNEL_ID = "UCGIY_O-8vW4rfX98KlMkvRg";
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${NINTENDO_CHANNEL_ID}`;
const CONFIDENCE_THRESHOLD = 0.85;

// Videos matching these are handled by detect-directs, skip them here
const DIRECT_KEYWORDS = [
  "nintendo direct",
  "direct mini",
  "indie world",
  "partner showcase",
  "nintendo today",
];

// Only process videos that look like game trailers/announcements
const TRAILER_KEYWORDS = [
  "trailer",
  "reveal",
  "announcement",
  "announced",
  "gameplay",
  "launch",
  "coming to",
  "coming soon",
  "gameplay overview",
  "story trailer",
  "character trailer",
];

interface RSSEntry {
  videoId: string;
  title: string;
  description: string;
  published: string;
  thumbnailUrl: string;
}

interface ClaudeMatch {
  is_trailer: boolean;
  matched_game_title: string | null;
  matched_franchise: string | null;
  confidence: number;
  reasoning: string;
}

async function fetchRSSEntries(): Promise<RSSEntry[]> {
  const res = await fetch(RSS_URL, {
    headers: { "User-Agent": "Blippd/1.0 (Nintendo eShop price tracker)" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`YouTube RSS fetch failed: ${res.status}`);

  const xml = await res.text();
  const entries: RSSEntry[] = [];

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const videoId = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
    const title = block.match(/<title>(.*?)<\/title>/)?.[1];
    const published = block.match(/<published>(.*?)<\/published>/)?.[1];
    const description =
      block.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? "";
    const thumbnailUrl =
      block.match(/url="(https:\/\/i\.ytimg\.com[^"]+)"/)?.[1] ?? "";

    if (videoId && title && published) {
      entries.push({
        videoId,
        title: decodeXML(title),
        description: decodeXML(description).slice(0, 500),
        published,
        thumbnailUrl,
      });
    }
  }

  return entries;
}

function decodeXML(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isDirectVideo(title: string): boolean {
  const lower = title.toLowerCase();
  return DIRECT_KEYWORDS.some((kw) => lower.includes(kw));
}

function looksLikeTrailer(title: string): boolean {
  const lower = title.toLowerCase();
  return TRAILER_KEYWORDS.some((kw) => lower.includes(kw));
}

async function matchWithClaude(
  title: string,
  description: string
): Promise<ClaudeMatch> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `You are analyzing a Nintendo YouTube video to identify which game it features.

Video title: "${title}"
Video description: "${description || "(none)"}"

Tasks:
1. Is this a game-specific trailer or announcement? (If it's a general showcase, compilation, or unrelated content, say false)
2. What is the exact game title being featured? (null if only franchise-level or unclear)
3. What franchise does it belong to? (e.g. "Zelda", "Mario", "Metroid", "Splatoon", "Pokemon")
4. How confident are you in this match? (0.0 = no idea, 1.0 = certain)

Respond with ONLY valid JSON, no markdown or extra text:
{"is_trailer":boolean,"matched_game_title":"exact title or null","matched_franchise":"franchise or null","confidence":0.0,"reasoning":"one sentence"}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";
  return JSON.parse(text);
}

async function findGameInDB(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  gameTitle: string
): Promise<{ id: string; slug: string; title: string } | null> {
  // Try exact match first, then fuzzy
  const { data } = await supabase
    .from("games")
    .select("id, slug, title")
    .ilike("title", gameTitle)
    .limit(1);

  if (data && data.length > 0) return data[0];

  // Try partial match (handles subtitle variations)
  const baseTitle = gameTitle.split(":")[0].trim();
  const { data: partial } = await supabase
    .from("games")
    .select("id, slug, title")
    .ilike("title", `%${baseTitle}%`)
    .limit(1);

  return partial && partial.length > 0 ? partial[0] : null;
}

async function autoPublishAlert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  game: { id: string; title: string },
  videoTitle: string
): Promise<string | null> {
  // Insert alert
  const { data: alert, error } = await supabase
    .from("alerts")
    .insert({
      game_id: game.id,
      type: "announced",
      headline: `${game.title} — new trailer`,
      subtext: videoTitle,
    })
    .select("id")
    .single();

  if (error || !alert) {
    console.error("Failed to insert announced alert:", error?.message);
    return null;
  }

  // Notify all followers of this game who have announcements enabled
  const { data: followers } = await supabase
    .from("user_game_follows")
    .select("user_id")
    .eq("game_id", game.id)
    .eq("notify_announcements", true);

  if (followers && followers.length > 0) {
    const rows = followers.map((f: { user_id: string }) => ({
      user_id: f.user_id,
      alert_id: alert.id,
      read: false,
    }));
    await supabase.from("user_alert_status").insert(rows);
  }

  return alert.id;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: true, skipped: true, reason: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const entries = await fetchRSSEntries();
    const supabase = createAdminClient();

    // Only check last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEntries = entries.filter(
      (e) => new Date(e.published) > cutoff
    );

    // Skip Directs (handled by detect-directs cron)
    const candidates = recentEntries.filter(
      (e) => !isDirectVideo(e.title) && looksLikeTrailer(e.title)
    );

    const results = {
      checked: entries.length,
      recent: recentEntries.length,
      candidates: candidates.length,
      processed: 0,
      autoPublished: 0,
      pending: 0,
      skipped: 0,
    };

    for (const entry of candidates) {
      // Skip if already processed
      const { data: existing } = await supabase
        .from("trailer_detections")
        .select("id")
        .eq("video_id", entry.videoId)
        .limit(1);

      if (existing && existing.length > 0) {
        results.skipped++;
        continue;
      }

      results.processed++;

      let matchResult: ClaudeMatch;
      try {
        matchResult = await matchWithClaude(entry.title, entry.description);
      } catch (err) {
        console.error(`Claude match failed for "${entry.title}":`, err);
        // Insert as pending with no match data so admin can review
        await supabase.from("trailer_detections").insert({
          video_id: entry.videoId,
          title: entry.title,
          description: entry.description,
          published_at: entry.published,
          thumbnail_url: entry.thumbnailUrl,
          status: "pending",
          claude_reasoning: "Claude API error — manual review required",
        });
        results.pending++;
        continue;
      }

      if (!matchResult.is_trailer) {
        results.skipped++;
        continue;
      }

      // Try to find the game in our DB
      let matchedGame: { id: string; slug: string; title: string } | null = null;
      if (matchResult.matched_game_title) {
        matchedGame = await findGameInDB(supabase, matchResult.matched_game_title);
      }

      const canAutoPublish =
        matchedGame !== null && matchResult.confidence >= CONFIDENCE_THRESHOLD;

      let alertId: string | null = null;
      let status: "auto_published" | "pending" = "pending";

      if (canAutoPublish) {
        alertId = await autoPublishAlert(supabase, matchedGame!, entry.title);
        if (alertId) {
          status = "auto_published";
          results.autoPublished++;
        } else {
          results.pending++;
        }
      } else {
        results.pending++;
      }

      await supabase.from("trailer_detections").insert({
        video_id: entry.videoId,
        title: entry.title,
        description: entry.description,
        published_at: entry.published,
        thumbnail_url: entry.thumbnailUrl,
        matched_game_id: matchedGame?.id ?? null,
        matched_game_slug: matchedGame?.slug ?? null,
        matched_game_title: matchResult.matched_game_title,
        matched_franchise: matchResult.matched_franchise,
        confidence: matchResult.confidence,
        claude_reasoning: matchResult.reasoning,
        status,
        alert_id: alertId,
      });

      console.log(
        `[detect-trailers] "${entry.title}" → ${status} (confidence: ${matchResult.confidence}, game: ${matchedGame?.title ?? "not in DB"})`
      );
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error("detect-trailers failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
