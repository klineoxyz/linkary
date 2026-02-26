/**
 * GET /api/public/resolve?slug=...
 * Owner-aware resolver for /{slug}. Reads session from cookies; returns public | owner | claim.
 * Cache-Control: no-store (per-user).
 *
 * Session reading: createServerSupabase() uses cookies() from next/headers, which in a Route Handler
 * is the incoming request's cookies. The slug page forwards the same request's cookie header when
 * it calls this API (Cookie: cookieStore.getAll().map(...).join("; ")), so the session is available
 * and getUser() returns the logged-in user when cookies were set by /api/auth/set-session after login.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

export type ResolveResult =
  | { kind: "public"; slug: string }
  | { kind: "owner"; slug: string; profile_id: string }
  | { kind: "claim"; slug: string };

const isDev = process.env.NODE_ENV === "development";

export async function GET(request: NextRequest) {
  const slugRaw = request.nextUrl.searchParams.get("slug");
  const slug = slugRaw ? normalize(slugRaw) : "";
  if (!slug) {
    return NextResponse.json({ kind: "claim" as const, slug: "" }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let debug: { hasSession: boolean; matched: "username" | "twitter_username" | null } | undefined;

  // 1) Published lookup: public_profile_view (profiles only; view has username, published = true)
  const { data: publicProfile } = await supabase
    .from("public_profile_view")
    .select("username")
    .ilike("username", slug)
    .maybeSingle();

  if (publicProfile && (publicProfile as { username?: string }).username) {
    return NextResponse.json(
      { kind: "public" as const, slug },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 2) Owner check: need session from cookies
  const supabaseServer = await createServerSupabase();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (isDev) {
    debug = { hasSession: !!user, matched: null };
  }

  if (!user?.id) {
    return NextResponse.json(
      { kind: "claim" as const, slug, ...(debug && { debug }) },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("id, username, twitter_username, published")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { kind: "claim" as const, slug, ...(debug && { debug }) },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const row = profile as { username?: string | null; twitter_username?: string | null; published?: boolean };
  const usernameNorm = (row.username ?? "").trim().toLowerCase().replace(/^@/, "");
  const twitterNorm = (row.twitter_username ?? "").trim().toLowerCase().replace(/^@/, "");

  let matched: "username" | "twitter_username" | null = null;
  if (usernameNorm === slug) matched = "username";
  else if (twitterNorm === slug) matched = "twitter_username";

  if (isDev && debug) debug.matched = matched;

  if (matched) {
    const profileId = (profile as { id: string }).id;
    return NextResponse.json(
      {
        kind: "owner" as const,
        slug,
        profile_id: profileId,
        ...(debug && { debug }),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { kind: "claim" as const, slug, ...(debug && { debug }) },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
