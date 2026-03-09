import type { Metadata } from "next";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import FranchiseDetailClient from "./FranchiseDetailClient";

interface Props {
  params: Promise<{ name: string }>;
}

async function getFranchiseForMetadata(name: string) {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("franchises")
      .select("name, game_count, logo")
      .eq("name", name)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const franchise = await getFranchiseForMetadata(decodedName);

  if (!franchise) {
    return { title: "Franchise Not Found | Blippd" };
  }

  const title = `${franchise.name} Games — Prices & Alerts | Blippd`;
  const description = `Track prices for all ${franchise.game_count} ${franchise.name} games on Nintendo eShop. Get alerts when any ${franchise.name} game goes on sale.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Blippd",
      images: franchise.logo ? [{ url: franchise.logo, width: 600, height: 375, alt: franchise.name }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function FranchiseDetailPage({ params }: Props) {
  const { name } = await params;
  return <FranchiseDetailClient name={decodeURIComponent(name)} />;
}
