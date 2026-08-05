import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { isPlaceholderDate } from "@/lib/format";
import ReleaseTimeClient from "./ReleaseTimeClient";
import ReleaseTimeCta from "@/components/ReleaseTimeCta";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getGameForReleasePage(slug: string) {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("games")
      .select("id, slug, title, publisher, cover_art, release_date, release_status, has_physical_release")
      .eq("slug", slug)
      .single();
    return data;
  } catch {
    return null;
  }
}

const MAJOR_FIRST_PARTY_PUBLISHERS = ["nintendo", "sega", "capcom"];

// Predicts which of the four documented launch-time patterns applies to a
// specific game, using Nintendo's own catalog data (publisher + whether the
// listing has a physical edition) rather than showing all four generically.
function predictLaunchRule(
  publisher: string | null,
  hasPhysicalRelease: boolean | null
): LaunchTimeRule {
  const pub = (publisher ?? "").toLowerCase();
  if (MAJOR_FIRST_PARTY_PUBLISHERS.some((p) => pub.includes(p))) {
    return LAUNCH_RULES[2]; // Major first-party — midnight ET
  }
  if (hasPhysicalRelease) {
    return LAUNCH_RULES[1]; // Physical + digital — 9pm PT night before
  }
  return LAUNCH_RULES[0]; // Digital-only — 9am PT
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameForReleasePage(slug);

  if (!game) {
    return { title: "Game Not Found | Blippd" };
  }

  const title = `When Does ${game.title} Release? · Exact Launch Time | Blippd`;
  const description = `Find out exactly when ${game.title} launches on Nintendo eShop. Get the release time in your timezone and set up alerts so you don't miss it.`;

  return {
    title,
    description,
    alternates: { canonical: `/games/${slug}/release-time` },
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
        <Link href="/home" className="inline-block mt-4 text-sm text-[#888888] hover:text-white hover:underline">
          &larr; Back to Home
        </Link>
      </div>
    );
  }

  const hasDate = game.release_date && !isPlaceholderDate(game.release_date);
  const isReleased = game.release_status === "released";
  const releaseDate = hasDate ? new Date(game.release_date + "T00:00:00Z") : null;
  const predictedRule = predictLaunchRule(game.publisher, game.has_physical_release);

  return (
    <div className="px-4 pb-28 max-w-2xl mx-auto">
      {/* Back nav */}
      <div className="py-4">
        <Link href={`/game/${game.slug}`} className="text-[#888888] text-sm hover:text-white hover:underline">
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
            <div className="mt-4 pt-4 border-t border-[#222222] flex items-center justify-between">
              <span className="text-[#888888] text-sm">Predicted launch time</span>
              <span className="text-[#00ff88] text-sm font-bold">{predictedRule.time}</span>
            </div>
          </>
        ) : (
          <>
            <div className="text-[#ffbd3f] text-xs font-bold tracking-wider mb-1">TBA</div>
            <p className="text-white text-lg font-bold">Release date not yet announced</p>
            <p className="text-[#888888] text-sm mt-1">
              Watch {game.title} on Blippd to get notified the moment a release date is confirmed.
            </p>
          </>
        )}
      </div>

      {/* Predicted launch time — only shown for unreleased games with a real date */}
      {!isReleased && hasDate && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-white mb-3">
            How we predict this
          </h2>
          <p className="text-[#888888] text-sm mb-3 leading-relaxed">
            Nintendo doesn&apos;t publish exact launch times, so this is our best
            estimate based on historical patterns, not officially confirmed.
          </p>
          <div className="bg-[#111111] rounded-xl border border-[#222222] p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white text-sm font-medium">{predictedRule.label}</span>
              <span className="text-[#00ff88] text-sm font-bold">{predictedRule.time}</span>
            </div>
            <p className="text-[#666666] text-xs leading-relaxed">{predictedRule.description}</p>
          </div>
        </div>
      )}

      {/* CTA (client component: reads follow state so an already-watching
          user sees their Watching status, not a "Watch & Get Notified"
          pitch for something they've already done) */}
      <ReleaseTimeCta
        gameId={game.id}
        gameSlug={game.slug}
        gameTitle={game.title}
        isReleased={isReleased}
      />

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
