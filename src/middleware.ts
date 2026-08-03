import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() revalidates against Supabase's auth server rather than just
  // decoding the session cookie locally — getSession() can act on a stale or
  // already-revoked session, which shows up as a confusing bounce-then-bounce-
  // back redirect loop rather than a clean "you're signed out" state.
  const { data: { user } } = await supabase.auth.getUser();

  // Signed-in users hitting the landing page should go straight to /home
  if (user && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  // Signed-in users hitting /login should go to /home
  if (user && req.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  return res;
}

export const config = {
  // Cron routes authenticate via their own CRON_SECRET bearer token and static
  // assets need no auth at all — running Supabase auth on every request to
  // these was pure overhead with no behavioral purpose.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.svg|favicon\\.ico|icon-.*\\.png|manifest\\.json|sw\\.js|images/|api/).*)",
  ],
};
