import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Canonical host: apex (no www). Auth cookies are set on this host so session works everywhere. */
const CANONICAL_APEX = "linkary.xyz";

/**
 * 1) Enforce canonical domain: redirect www to apex (308) so auth session works.
 *    Session cookies are scoped to the host; www and apex are different, so we use one host only.
 * 2) Redirect /@username to /username (canonical public profile path).
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = (url.hostname ?? request.headers.get("host") ?? "").toLowerCase().split(":")[0];

  // Redirect www to apex for our production domain only (skip localhost / 127.0.0.1)
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

  // Optional: redirect non-canonical production host to apex (e.g. vercel.app -> linkary.xyz when we want one domain)
  // Not applied here so preview deployments still work; set NEXT_PUBLIC_APP_URL / Vercel prod domain to linkary.xyz.

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
