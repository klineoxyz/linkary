/**
 * GET /api/public/resolve?slug=...
 * Owner-aware resolver for /{slug}. Uses shared resolveSlug() so session is read from cookies.
 * Cache-Control: no-store.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveSlug } from "@/lib/resolveSlugServer";

export type ResolveResult = Awaited<ReturnType<typeof resolveSlug>>;

export async function GET(request: NextRequest) {
  const slugRaw = request.nextUrl.searchParams.get("slug") ?? "";
  const result = await resolveSlug(slugRaw);
  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
