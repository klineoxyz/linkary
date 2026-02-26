import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Canonical host (apex). Session cookies are set here; www must redirect here so /username recognizes the owner. */
const CANONICAL_APEX = "linkary.xyz";

/**
 * 1) Redirect www.linkary.xyz → linkary.xyz (308) so auth session works. Without this, www has no cookie and shows "Claim".
 * 2) Redirect /@username → /username (301).
 *
 * If you see ERR_TOO_MANY_REDIRECTS: in Vercel Domains, do NOT redirect linkary.xyz → www. Set linkary.xyz as primary; add www with "Redirect to linkary.xyz".
 */
export function middleware(request: NextRequest) {
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
