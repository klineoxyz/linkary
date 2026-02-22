import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Redirect /@username to /username so both work; public profile is canonical at /username.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1 && segments[0].startsWith("@")) {
    const slug = segments[0].slice(1);
    if (slug.length > 0) {
      const url = request.nextUrl.clone();
      url.pathname = `/${encodeURIComponent(slug)}`;
      return NextResponse.redirect(url, 301);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
