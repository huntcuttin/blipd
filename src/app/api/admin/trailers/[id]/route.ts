import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 30;

function isAdmin(email: string | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  return !!adminEmail && email === adminEmail;
}

async function getSessionEmail(): Promise<string | undefined> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const email = await getSessionEmail();
  if (!isAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { action, gameSlug } = body as {
    action: "approve" | "reject" | "reassign";
    gameSlug?: string;
  };

  const supabase = createAdminClient();

  // Fetch the detection
  const { data: detection, error: fetchError } = await supabase
    .from("trailer_detections")
    .select("*")
    .eq("id", params.id)
    .single();

  if (fetchError || !detection) {
    return NextResponse.json({ error: "Detection not found" }, { status: 404 });
  }

  if (detection.status !== "pending") {
    return NextResponse.json(
      { error: "Detection is not pending" },
      { status: 400 }
    );
  }

  if (action === "reject") {
    await supabase
      .from("trailer_detections")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: email })
      .eq("id", params.id);

    return NextResponse.json({ ok: true, action: "rejected" });
  }

  // approve or reassign — need a game slug to fire the alert
  const slug = gameSlug ?? detection.matched_game_slug;
  if (!slug) {
    return NextResponse.json(
      { error: "No game slug provided and no matched game in detection" },
      { status: 400 }
    );
  }

  // Look up the game
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, title, slug")
    .eq("slug", slug)
    .single();

  if (gameError || !game) {
    return NextResponse.json(
      { error: `Game not found for slug: ${slug}` },
      { status: 404 }
    );
  }

  // Insert alert
  const { data: alert, error: alertError } = await supabase
    .from("alerts")
    .insert({
      game_id: game.id,
      type: "announced",
      headline: `${game.title} — new trailer`,
      subtext: detection.title,
    })
    .select("id")
    .single();

  if (alertError || !alert) {
    return NextResponse.json(
      { error: "Failed to insert alert", detail: alertError?.message },
      { status: 500 }
    );
  }

  // Notify followers with announcements enabled
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

  // Update detection
  await supabase
    .from("trailer_detections")
    .update({
      status: "approved",
      alert_id: alert.id,
      matched_game_id: game.id,
      matched_game_slug: game.slug,
      matched_game_title: game.title,
      reviewed_at: new Date().toISOString(),
      reviewed_by: email,
    })
    .eq("id", params.id);

  return NextResponse.json({
    ok: true,
    action: action === "reassign" ? "reassigned_and_approved" : "approved",
    alertId: alert.id,
    game: game.title,
    notified: followers?.length ?? 0,
  });
}
