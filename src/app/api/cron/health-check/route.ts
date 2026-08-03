import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/nintendo/admin-client";

export const runtime = "nodejs";
export const maxDuration = 30;

// update-prices runs every 10 min — 3x that gives room for a slow run
// without flagging a false positive.
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

// Only jobs whose disable/failure genuinely breaks the pipeline are worth
// paging on — this list intentionally mirrors the crons in CLAUDE.md.
const MONITORED_CRON_TITLES = new Set([
  "Price Check (base)",
  "Dispatch Notifications",
  "Catalog Sync",
  "Sync IGDB Hype",
  "Sync IGDB Ratings",
  "Sync Release Dates",
  "Detect Nintendo Directs",
  "Detect Game Trailers",
  "Weekly Digest",
]);

interface CronJobOrgJob {
  title: string;
  enabled: boolean;
  lastStatus: number;
}

async function checkCronJobOrg(): Promise<string[]> {
  const key = process.env.CRON_JOB_ORG_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch("https://api.cron-job.org/jobs", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [`cron-job.org API returned ${res.status}`];

    const data = (await res.json()) as { jobs: CronJobOrgJob[] };
    const problems: string[] = [];
    for (const job of data.jobs ?? []) {
      if (!MONITORED_CRON_TITLES.has(job.title)) continue;
      if (!job.enabled) {
        problems.push(`"${job.title}" is disabled on cron-job.org`);
      } else if (job.lastStatus && job.lastStatus !== 1) {
        problems.push(`"${job.title}" last run failed (status ${job.lastStatus})`);
      }
    }
    return problems;
  } catch (error) {
    return [`Failed to reach cron-job.org: ${error instanceof Error ? error.message : String(error)}`];
  }
}

async function checkPricePipelineFreshness(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("games")
    .select("last_price_check")
    .order("last_price_check", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) return [`Failed to check price pipeline freshness: ${error.message}`];
  if (!data?.last_price_check) return ["No games have ever had a price check"];

  const ageMs = Date.now() - new Date(data.last_price_check).getTime();
  if (ageMs > STALE_THRESHOLD_MS) {
    return [`Price pipeline stale: freshest last_price_check is ${Math.round(ageMs / 60000)} min old (expected < 30 min)`];
  }
  return [];
}

async function sendAlertEmail(problems: string[]): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!key || !adminEmail) {
    console.error("Health check found problems but RESEND_API_KEY/ADMIN_EMAIL not configured:", problems);
    return;
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: "Blippd <alerts@blippd.app>",
    to: adminEmail,
    subject: `Blippd pipeline health check — ${problems.length} issue${problems.length === 1 ? "" : "s"} found`,
    text: problems.map((p) => `- ${p}`).join("\n"),
  });
  if (error) console.error("Failed to send health-check alert email:", error.message);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [cronProblems, freshnessProblems] = await Promise.all([
    checkCronJobOrg(),
    checkPricePipelineFreshness(),
  ]);

  const problems = [...cronProblems, ...freshnessProblems];

  if (problems.length > 0) {
    console.error("Health check found problems:", problems);
    await sendAlertEmail(problems);
  } else {
    console.log("Health check passed");
  }

  return NextResponse.json({ ok: problems.length === 0, problems });
}
