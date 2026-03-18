import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { weeklyDigest } from "@/lib/notifications/digest-template";

export const runtime = "nodejs";
export const maxDuration = 300;

const FROM_ADDRESS = "Blippd <alerts@blippd.app>";

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  resendClient = new Resend(key);
  return resendClient;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Get all users who follow at least one game
    const { data: follows, error: followsError } = await supabase
      .from("user_game_follows")
      .select("user_id, game_id");

    if (followsError || !follows) {
      console.error("Failed to fetch follows:", followsError?.message);
      return NextResponse.json({ ok: false, error: followsError?.message }, { status: 500 });
    }

    // Group follows by user
    const userFollows = new Map<string, string[]>();
    for (const f of follows) {
      const list = userFollows.get(f.user_id) ?? [];
      list.push(f.game_id);
      userFollows.set(f.user_id, list);
    }

    if (userFollows.size === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: "No users with follows" });
    }

    // Get all followed game IDs
    const allGameIds = Array.from(new Set(follows.map((f) => f.game_id)));

    // Fetch game data for all followed games that are on sale
    const { data: gamesOnSale } = await supabase
      .from("games")
      .select("id, title, slug, current_price, original_price, discount, is_all_time_low, nsuid, nintendo_url")
      .in("id", allGameIds)
      .eq("is_on_sale", true)
      .eq("is_suppressed", false);

    const saleGameMap = new Map<string, typeof gamesOnSale extends (infer T)[] | null ? T : never>();
    for (const g of gamesOnSale ?? []) {
      saleGameMap.set(g.id, g);
    }

    // Send digest to each user
    const resend = getResend();
    let sent = 0;
    let skipped = 0;

    const userEntries = Array.from(userFollows.entries());

    // Process in batches of 3 (Resend rate limit)
    for (let i = 0; i < userEntries.length; i += 3) {
      const batch = userEntries.slice(i, i + 3);

      await Promise.allSettled(
        batch.map(async ([userId, gameIds]) => {
          // Get user email
          const { data: userData } = await supabase.auth.admin.getUserById(userId);
          const email = userData?.user?.email;
          if (!email) {
            skipped++;
            return;
          }

          // Build digest data for this user
          const userSaleGames = gameIds
            .map((gid) => saleGameMap.get(gid))
            .filter((g): g is NonNullable<typeof g> => g != null)
            .map((g) => ({
              title: g.title,
              slug: g.slug,
              currentPrice: Number(g.current_price),
              originalPrice: Number(g.original_price),
              discount: g.discount ?? 0,
              isAllTimeLow: g.is_all_time_low ?? false,
              nsuid: g.nsuid,
              nintendoUrl: g.nintendo_url ?? null,
            }))
            .sort((a, b) => b.discount - a.discount); // Highest discount first

          const { subject, html } = weeklyDigest({
            salesCount: userSaleGames.length,
            games: userSaleGames.slice(0, 10), // Cap at 10 games per digest
            totalFollowed: gameIds.length,
          });

          try {
            await resend.emails.send({
              from: FROM_ADDRESS,
              to: email,
              subject,
              html,
            });
            sent++;
          } catch (err) {
            console.error(`Failed to send digest to ${email}:`, err);
            skipped++;
          }
        })
      );

      // Rate limit pause between batches
      if (i + 3 < userEntries.length) {
        await new Promise((r) => setTimeout(r, 1100));
      }
    }

    console.log(`Weekly digest complete: ${sent} sent, ${skipped} skipped`);

    return NextResponse.json({
      ok: true,
      users: userFollows.size,
      sent,
      skipped,
    });
  } catch (error) {
    console.error("Weekly digest failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
