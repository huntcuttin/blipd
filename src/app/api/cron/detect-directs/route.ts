import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { fetchWithRetry } from "@/lib/retry";

export const runtime = "nodejs";
export const maxDuration = 30;

// Nintendo's official YouTube channel ID
const NINTENDO_CHANNEL_ID = "UCGIY_O-8vW4rfX98KlMkvRg";
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${NINTENDO_CHANNEL_ID}`;

// Keywords that indicate a Nintendo Direct or major event
const DIRECT_KEYWORDS = [
  "nintendo direct",
  "direct mini",
  "indie world",
  "partner showcase",
];

// How long to show the banner after detection (2 hours)
const BANNER_DURATION_MS = 2 * 60 * 60 * 1000;

interface RSSEntry {
  videoId: string;
  title: string;
  published: string;
}

async function fetchRSSEntries(): Promise<RSSEntry[]> {
  const res = await fetchWithRetry(
    RSS_URL,
    { headers: { "User-Agent": "Blippd/1.0 (Nintendo eShop price tracker)" } },
    { retries: 2, timeoutMs: 10000, label: "YouTube RSS (directs)" }
  );

  if (!res.ok) {
    throw new Error(`YouTube RSS fetch failed: ${res.status}`);
  }

  const xml = await res.text();
  const entries: RSSEntry[] = [];

  // Simple XML parsing — extract <entry> blocks
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const videoId = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
    const title = block.match(/<title>(.*?)<\/title>/)?.[1];
    const published = block.match(/<published>(.*?)<\/published>/)?.[1];

    if (videoId && title && published) {
      entries.push({
        videoId,
        title: decodeXMLEntities(title),
        published,
      });
    }
  }

  return entries;
}

function decodeXMLEntities(str: string): string {
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

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entries = await fetchRSSEntries();
    const supabase = createAdminClient();

    // Only look at entries from the last 4 hours
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const recentEntries = entries.filter(
      (e) => new Date(e.published) > fourHoursAgo
    );

    const directEntries = recentEntries.filter((e) => isDirectVideo(e.title));

    if (directEntries.length === 0) {
      // Expire old directs
      await supabase
        .from("nintendo_directs")
        .update({ active: false })
        .eq("active", true)
        .lt("expires_at", new Date().toISOString());

      return NextResponse.json({
        ok: true,
        checked: entries.length,
        recent: recentEntries.length,
        detected: 0,
      });
    }

    let newDetections = 0;
    for (const entry of directEntries) {
      // Check if already detected
      const { data: existing } = await supabase
        .from("nintendo_directs")
        .select("id")
        .eq("video_id", entry.videoId)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Insert new detection
      const expiresAt = new Date(Date.now() + BANNER_DURATION_MS).toISOString();
      const { error } = await supabase.from("nintendo_directs").insert({
        video_id: entry.videoId,
        title: entry.title,
        published_at: entry.published,
        active: true,
        expires_at: expiresAt,
      });

      if (error) {
        console.error(`Failed to insert direct detection:`, error.message);
      } else {
        console.log(`Nintendo Direct detected: "${entry.title}" (${entry.videoId})`);
        newDetections++;
      }
    }

    // Expire old directs
    await supabase
      .from("nintendo_directs")
      .update({ active: false })
      .eq("active", true)
      .lt("expires_at", new Date().toISOString());

    return NextResponse.json({
      ok: true,
      checked: entries.length,
      recent: recentEntries.length,
      detected: directEntries.length,
      newDetections,
    });
  } catch (error) {
    console.error("Direct detection failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
