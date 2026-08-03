import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/nintendo/admin-client";

const BASE_URL = "https://www.blippd.app";

async function fetchAllGameSlugs(
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ slug: string; updated_at: string | null }[]> {
  // PostgREST caps unbounded selects at 1000 rows — the catalog has ~2,300
  // eligible games, so an unpaginated query silently truncated the sitemap.
  const PAGE_SIZE = 1000;
  const rows: { slug: string; updated_at: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await supabase
      .from("games")
      .select("slug, updated_at")
      .eq("is_suppressed", false)
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  // Fetch all non-suppressed game slugs, paginated past PostgREST's row cap
  const games = await fetchAllGameSlugs(supabase);

  // Fetch all franchise names
  const { data: franchises } = await supabase
    .from("franchises")
    .select("name")
    .order("popularity_score", { ascending: false });

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/home`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/sales`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/upcoming`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/deals`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/vs/nt-deals`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE_URL}/terms`, changeFrequency: "monthly", priority: 0.2 },
  ];

  const gamePages: MetadataRoute.Sitemap = games.map((g) => ({
    url: `${BASE_URL}/game/${g.slug}`,
    lastModified: g.updated_at ? new Date(g.updated_at) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const releaseTimePages: MetadataRoute.Sitemap = games.map((g) => ({
    url: `${BASE_URL}/games/${g.slug}/release-time`,
    lastModified: g.updated_at ? new Date(g.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const franchisePages: MetadataRoute.Sitemap = (franchises ?? []).map((f) => ({
    url: `${BASE_URL}/franchise/${encodeURIComponent(f.name)}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...gamePages, ...releaseTimePages, ...franchisePages];
}
