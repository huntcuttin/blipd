import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";

export const maxDuration = 30;

/**
 * Permanent account deletion, requested by the account's own owner.
 *
 * Auth follows the same bearer-token pattern as /api/push/subscribe: the
 * client sends its Supabase access token, we verify it server-side with the
 * admin client, and the token's own user id is the only account this route
 * will ever touch. There is no "delete user X" parameter by design.
 *
 * Every per-user table cascades from auth.users (verified live against
 * pg_constraint 2026-08-17: user_game_follows, user_franchise_follows,
 * user_game_owns, user_retro_follows, user_alert_status, user_profiles,
 * push_subscriptions). Two tables do not and are cleaned up explicitly:
 *   - notification_log has no FK to auth.users at all.
 *   - email_suppressions is keyed by email address, not user_id.
 */
export async function DELETE(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabase = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Non-cascading cleanup first. A failure here is logged but does not block
  // the deletion itself: the user asked for their account to be gone, and a
  // leftover internal log row (user_id of a nonexistent user, no email, no
  // content) is not a reason to refuse them that.
  const { error: logError } = await supabase
    .from("notification_log")
    .delete()
    .eq("user_id", user.id);
  if (logError) {
    console.error(`Account deletion: notification_log cleanup failed for ${user.id}: ${logError.message}`);
  }

  // Their email address is personal data, so it goes with the account. This
  // does clear any bounce/complaint suppression on that address. That is the
  // correct trade: a deleted account has no follows and therefore no alerts,
  // and if the same address ever signs up again the webhook re-suppresses it
  // on the next real bounce.
  if (user.email) {
    const { error: suppressionError } = await supabase
      .from("email_suppressions")
      .delete()
      .eq("email", user.email);
    if (suppressionError) {
      console.error(`Account deletion: email_suppressions cleanup failed for ${user.id}: ${suppressionError.message}`);
    }
  }

  // The irreversible step, last. Everything above is recoverable-ish noise if
  // the process dies mid-flight; this is not, so nothing runs after it.
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error(`Account deletion FAILED for ${user.id}: ${deleteError.message}`);
    return NextResponse.json({ error: "Could not delete account" }, { status: 500 });
  }

  console.log(`Account deleted: ${user.id}`);
  return NextResponse.json({ ok: true });
}
