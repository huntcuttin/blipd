import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/nintendo/admin-client";
import TrailersClient from "./TrailersClient";

export const dynamic = "force-dynamic";

export default async function AdminTrailersPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — cookie setting handled by middleware
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Same source as the API route's isAdmin() check — a hardcoded literal here
  // meant the page could render for an admin while every action 403'd if
  // ADMIN_EMAIL was ever unset or different in a given deploy environment.
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) {
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
