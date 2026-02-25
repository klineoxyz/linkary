import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Redirect /@username to /username (canonical public profile path).
 *
 * Canonical domain (www → apex): Do NOT redirect www in middleware here to avoid redirect loops
 * when the host (e.g. Vercel) redirects apex → www. Configure your host instead:
 * - Vercel: Domains → set linkary.xyz as primary; add www.linkary.xyz with "Redirect to linkary.xyz".
 * - Set NEXT_PUBLIC_SITE_URL=https://linkary.xyz so auth and safe-redirect use apex.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
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
