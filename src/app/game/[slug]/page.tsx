import type { Metadata } from "next";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import GameDetailClient from "./GameDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getGameForMetadata(slug: string) {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("games")
      .select("title, publisher, current_price, original_price, discount, is_on_sale, cover_art, release_status")
      .eq("slug", slug)
      .single();
    return data;
  } catch {
    return null;
  }
}

function formatMetaPrice(price: number): string {
  return price === 0 ? "Free" : `$${price.toFixed(2)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameForMetadata(slug);

  if (!game) {
    return {
      title: "Game Not Found | Blippd",
      description: "This game could not be found on Blippd.",
    };
  }

  const title = `${game.title} — Price & Alerts | Blippd`;

  let description: string;
  if (game.is_on_sale && game.discount) {
    description = `${game.title} is ${game.discount}% off — now ${formatMetaPrice(game.current_price)} (was ${formatMetaPrice(game.original_price)}). Get price drop alerts on Blippd.`;
  } else if (game.release_status === "upcoming") {
    description = `${game.title} is coming soon. Follow on Blippd to get notified when it releases or goes on sale.`;
  } else {
    description = `Track ${game.title} prices and get alerts when it goes on sale. Currently ${formatMetaPrice(game.current_price)} on Nintendo eShop.`;
  }

  const images = game.cover_art ? [{ url: game.cover_art, width: 600, height: 375, alt: game.title }] : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Blippd",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: game.cover_art ? [game.cover_art] : [],
    },
  };
}

export default async function GameDetailPage({ params }: Props) {
  const { slug } = await params;
  return <GameDetailClient slug={slug} />;
}
