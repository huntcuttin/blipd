import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/nintendo/admin-client";

const BASE_URL = "https://www.blippd.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  // Fetch all non-suppressed game slugs
  const { data: games } = await supabase
    .from("games")
    .select("slug, updated_at")
    .eq("is_suppressed", false)
    .order("updated_at", { ascending: false });

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
    { url: `${BASE_URL}/vs/nt-deals`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE_URL}/terms`, changeFrequency: "monthly", priority: 0.2 },
  ];

  const gamePages: MetadataRoute.Sitemap = (games ?? []).map((g) => ({
    url: `${BASE_URL}/game/${g.slug}`,
    lastModified: g.updated_at ? new Date(g.updated_at) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const releaseTimePages: MetadataRoute.Sitemap = (games ?? []).map((g) => ({
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
