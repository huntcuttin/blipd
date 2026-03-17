import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { isPlaceholderDate } from "@/lib/format";
import ReleaseTimeClient from "./ReleaseTimeClient";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getGameForReleasePage(slug: string) {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("games")
      .select("id, slug, title, publisher, cover_art, release_date, release_status")
      .eq("slug", slug)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameForReleasePage(slug);

  if (!game) {
    return { title: "Game Not Found | Blippd" };
  }

  const title = `When Does ${game.title} Release? — Exact Launch Time | Blippd`;
  const description = `Find out exactly when ${game.title} launches on Nintendo eShop. Get the release time in your timezone and set up alerts so you don't miss it.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "Blippd",
      images: game.cover_art ? [{ url: game.cover_art, width: 600, height: 375, alt: game.title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

type LaunchTimeRule = {
  label: string;
  time: string;
  description: string;
};

const LAUNCH_RULES: LaunchTimeRule[] = [
  {
    label: "Digital-only titles",
    time: "9:00 AM PT",
    description: "Most digital-only games appear on the eShop at 9:00 AM Pacific Time on their release date.",
  },
  {
    label: "Physical + digital releases",
    time: "9:00 PM PT (night before)",
    description: "Games with both physical and digital versions typically go live at 9:00 PM Pacific the night before the listed release date.",
  },
  {
    label: "Major first-party titles",
    time: "Midnight ET",
    description: "Big Nintendo, Sega, and Capcom titles often launch at midnight Eastern Time (9:00 PM PT the night before).",
  },
  {
    label: "Some third-party titles",
    time: "12:00 PM PT",
    description: "A few third-party publishers release at noon Pacific on release day instead of the morning.",
  },
];

export default async function ReleaseTimePage({ params }: Props) {
  const { slug } = await params;
  const game = await getGameForReleasePage(slug);

  if (!game) {
    return (
      <div className="px-4 py-20 text-center">
        <p className="text-[#666666] text-sm">Game not found</p>
        <Link href="/home" className="inline-block mt-4 text-sm text-[#00ff88] hover:underline">
          &larr; Back to Home
        </Link>
      </div>
    );
  }

  const hasDate = game.release_date && !isPlaceholderDate(game.release_date);
  const isReleased = game.release_status === "released";
  const releaseDate = hasDate ? new Date(game.release_date + "T00:00:00Z") : null;

  return (
    <div className="px-4 pb-28 max-w-2xl mx-auto">
      {/* Back nav */}
      <div className="py-4">
        <Link href={`/game/${game.slug}`} className="text-[#00ff88] text-sm hover:underline">
          &larr; {game.title}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white leading-tight">
          When Does {game.title} Release?
        </h1>
        <p className="text-[#888888] text-sm mt-2">
          {game.publisher && `By ${game.publisher} · `}Nintendo eShop US
        </p>
      </div>

      {/* Release status card */}
      <div className="bg-[#111111] rounded-xl border border-[#222222] p-5 mb-6">
        {isReleased ? (
          <>
            <div className="text-[#00ff88] text-xs font-bold tracking-wider mb-1">RELEASED</div>
            <p className="text-white text-lg font-bold">
              {game.title} is available now
            </p>
            {releaseDate && (
              <p className="text-[#888888] text-sm mt-1">
                Released{" "}
                {releaseDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </p>
            )}
          </>
        ) : hasDate ? (
          <>
            <div className="text-[#00aaff] text-xs font-bold tracking-wider mb-1">RELEASE DATE</div>
            <p className="text-white text-2xl font-bold">
              {releaseDate!.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </p>
            <ReleaseTimeClient releaseDate={game.release_date} gameId={game.id} gameTitle={game.title} />
          </>
        ) : (
          <>
            <div className="text-[#ffbd3f] text-xs font-bold tracking-wider mb-1">TBA</div>
            <p className="text-white text-lg font-bold">Release date not yet announced</p>
            <p className="text-[#888888] text-sm mt-1">
              Follow {game.title} on Blippd to get notified the moment a release date is confirmed.
            </p>
          </>
        )}
      </div>

      {/* Launch time rules — only show for unreleased games */}
      {!isReleased && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-white mb-3">
            Nintendo eShop Launch Time Rules
          </h2>
          <p className="text-[#888888] text-sm mb-4 leading-relaxed">
            Nintendo doesn&apos;t publish exact launch times. Based on historical patterns,
            here&apos;s when games typically go live on the US eShop:
          </p>
          <div className="space-y-3">
            {LAUNCH_RULES.map((rule) => (
              <div key={rule.label} className="bg-[#111111] rounded-xl border border-[#222222] p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-medium">{rule.label}</span>
                  <span className="text-[#00ff88] text-sm font-bold">{rule.time}</span>
                </div>
                <p className="text-[#666666] text-xs leading-relaxed">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="bg-[#111111] rounded-xl border border-[#00ff88]/20 p-5 text-center">
        <h3 className="text-white font-bold text-base mb-2">
          {isReleased ? "Track price drops" : "Don't miss the launch"}
        </h3>
        <p className="text-[#888888] text-sm mb-4">
          {isReleased
            ? `Get notified when ${game.title} goes on sale.`
            : `Follow ${game.title} on Blippd to get an alert the moment it's available.`}
        </p>
        <Link
          href={`/game/${game.slug}`}
          className="inline-block px-6 py-3 rounded-xl bg-[#00ff88] text-[#0a0a0a] text-sm font-bold hover:bg-[#00dd77] transition-colors"
        >
          {isReleased ? "View Game" : "Follow & Get Notified"}
        </Link>
      </div>

      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoGame",
            name: game.title,
            ...(game.publisher ? { publisher: { "@type": "Organization", name: game.publisher } } : {}),
            gamePlatform: "Nintendo Switch",
            ...(hasDate ? { datePublished: game.release_date } : {}),
            ...(game.cover_art ? { image: game.cover_art } : {}),
          }),
        }}
      />
    </div>
  );
}
