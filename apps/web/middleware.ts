import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/** Canonical host (apex). Session cookies are set here; www must redirect here so /username recognizes the owner. */
const CANONICAL_APEX = "linkary.xyz";

const ADMIN_TWITTER_HANDLE = "muazxinthi";

/**
 * Old root app path → canonical /app/... path. 301 redirects (Phase 7).
 * profile/dashboard → /app/analytics per routeFromPathname; all others → /app/{same}.
 */
const ROOT_APP_REDIRECTS: Record<string, string> = {
  dashboard: "/app/dashboard",
  overview: "/app/overview",
  analytics: "/app/analytics",
  profile: "/app/profile",
  "profile/edit": "/app/profile/edit",
  "profile/deals": "/app/profile/deals",
  "profile/applications": "/app/profile/applications",
  "profile/insights": "/app/profile/insights",
  "profile/inbox": "/app/profile/inbox",
  "profile/requests": "/app/profile/requests",
  "profile/dashboard": "/app/analytics",
  settings: "/app/settings",
  "settings/integrations": "/app/settings/integrations",
  "settings/roles-skills": "/app/settings/roles-skills",
  "settings/wallet": "/app/settings/wallet",
  "work/requests": "/app/work/requests",
  explore: "/app/explore",
  market: "/app/market",
  messages: "/app/messages",
  circles: "/app/circles",
  plans: "/app/plans",
  pricing: "/app/pricing",
  billing: "/app/billing",
  leaderboards: "/app/leaderboards",
  creator: "/app/creator",
  brand: "/app/brand",
  agency: "/app/agency",
  calendar: "/app/calendar",
  xspaces: "/app/xspaces",
  host: "/app/host",
  availability: "/app/availability",
  monetization: "/app/monetization",
  "monetization-flow": "/app/monetization-flow",
  "kol-lists": "/app/kol-lists",
  "capital-partners": "/app/capital-partners",
  connections: "/app/connections",
  preferences: "/app/preferences",
  support: "/app/support",
  notifications: "/app/notifications",
  showcase: "/app/showcase",
  watchlist: "/app/watchlist",
};

/** Paths we must never redirect (public, auth, legal, api). */
function isExcludedRootAppPath(normalized: string): boolean {
  if (!normalized || normalized === "app" || normalized.startsWith("app/")) return true;
  if (["login", "onboarding", "terms", "privacy", "privacy-policy"].includes(normalized)) return true;
  if (normalized.startsWith("u/") || normalized.startsWith("org/") || normalized.startsWith("deal/")) return true;
  if (normalized.startsWith("auth/") || normalized.startsWith("api/") || normalized === "api") return true;
  return false;
}

/**
 * 1) Redirect www.linkary.xyz → linkary.xyz (308) so auth session works. Without this, www has no cookie and shows "Claim".
 * 2) Redirect /@username → /username (301).
 * 3) Redirect old root app paths → /app/... (301), preserving query string. Hash is not sent to server.
 *
 * If you see ERR_TOO_MANY_REDIRECTS: in Vercel Domains, do NOT redirect linkary.xyz → www. Set linkary.xyz as primary; add www with "Redirect to linkary.xyz".
 */
export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = (url.hostname ?? request.headers.get("host") ?? "").toLowerCase().split(":")[0];

  if (
    hostname !== "localhost" &&
    hostname !== "127.0.0.1" &&
    hostname === `www.${CANONICAL_APEX}`
  ) {
    const canonicalUrl = new URL(url);
    canonicalUrl.host = CANONICAL_APEX;
    canonicalUrl.protocol = url.protocol || "https:";
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const pathname = url.pathname;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1 && segments[0].startsWith("@")) {
    const slug = segments[0].slice(1);
    if (slug.length > 0) {
      const redirectUrl = url.clone();
      redirectUrl.pathname = `/${encodeURIComponent(slug)}`;
      return NextResponse.redirect(redirectUrl, 301);
    }
  }

  // Phase 7: 301 from old root app paths to /app/..., preserve query string
  const normalized = pathname.replace(/^\/+/, "").replace(/\/+$/, "") || "";
  if (!isExcludedRootAppPath(normalized)) {
    const destPath = ROOT_APP_REDIRECTS[normalized];
    if (destPath) {
      const redirectUrl = new URL(url);
      redirectUrl.pathname = destPath;
      // search (query string) is already on url; redirectUrl inherits from url when we set pathname on same origin
      redirectUrl.search = url.search;
      return NextResponse.redirect(redirectUrl, 301);
    }
  }

  // Invite gate: signed-in users without redeemed invite cannot use /app/* (compulsory invite on first login; no skipping)
  if (pathname.startsWith("/app")) {
    const response = NextResponse.next();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSet.forEach((c) => response.cookies.set(c.name, c.value, c.options as Parameters<NextResponse["cookies"]["set"]>[2]));
          },
        },
      });
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id && session.access_token) {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${session.access_token}` } },
        });
        const { data: profile } = await client
          .from("profiles")
          .select("inviter_id, twitter_username")
          .eq("id", session.user.id)
          .maybeSingle();
        const inviterId = (profile as { inviter_id?: string | null } | null)?.inviter_id;
        const twitter = ((profile as { twitter_username?: string | null } | null)?.twitter_username ?? "").replace(/^@/, "").toLowerCase();
        const fromMeta = (session.user?.user_metadata?.user_name ?? session.user?.user_metadata?.preferred_username ?? "").toString().replace(/^@/, "").toLowerCase();
        const allowed = (inviterId != null && inviterId !== "") || twitter === ADMIN_TWITTER_HANDLE || fromMeta === ADMIN_TWITTER_HANDLE;
        if (!allowed) {
          // Allow exact /app through so client shows InviteRequiredView; avoid redirect loop (redirecting /app -> /app).
          const isAppRoot = pathname === "/app" || pathname === "/app/";
          if (isAppRoot) return response;
          const toApp = new URL(url);
          toApp.pathname = "/app";
          toApp.search = "";
          return NextResponse.redirect(toApp, 302);
        }
      }
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
