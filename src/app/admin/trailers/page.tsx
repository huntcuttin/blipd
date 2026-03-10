import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import TrailersClient from "./TrailersClient";

export const dynamic = "force-dynamic";

export default async function AdminTrailersPage() {
  // Auth check
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

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user || user.email !== adminEmail) {
    redirect("/home");
  }

  // Fetch all trailer detections, newest first
  const admin = createAdminClient();
  const { data: detections } = await admin
    .from("trailer_detections")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(100);

  return <TrailersClient detections={detections ?? []} />;
}
