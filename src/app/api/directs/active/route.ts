import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/nintendo/admin-client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("nintendo_directs")
      .select("id, video_id, title, published_at, detected_at, expires_at")
      .eq("active", true)
      .gt("expires_at", new Date().toISOString())
      .order("detected_at", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ active: false }, { status: 200 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ active: false });
    }

    const direct = data[0];
    return NextResponse.json({
      active: true,
      title: direct.title,
      videoId: direct.video_id,
      detectedAt: direct.detected_at,
      expiresAt: direct.expires_at,
    });
  } catch {
    return NextResponse.json({ active: false });
  }
}
