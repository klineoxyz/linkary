import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/me/profile-status?username=xxx
 * Returns { isOwner: boolean, status?: "published" | "unpublished" }.
 * - Unauthenticated or invalid token: { isOwner: false } (no status).
 * - Authenticated but not owner of that username: { isOwner: false } (no status; does not leak unpublished).
 * - Owner: { isOwner: true, status: "published" | "unpublished" }.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ isOwner: false }, { status: 200 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ isOwner: false }, { status: 200 });
  }

  const username = request.nextUrl.searchParams.get("username");
  const segment = (username ?? "").trim().toLowerCase().replace(/^@/, "");
  if (!segment) {
    return NextResponse.json({ isOwner: false }, { status: 200 });
  }

  // 1) Look up by profiles.username (canonical slug)
  const { data: profileByUsername, error: profileError } = await supabase
    .from("profiles")
    .select("id, published")
    .ilike("username", segment)
    .maybeSingle();

  if (!profileError && profileByUsername && (profileByUsername as { id: string }).id === user.id) {
    const published = (profileByUsername as { published?: boolean }).published === true;
    return NextResponse.json(
      { isOwner: true, status: published ? "published" : "unpublished" },
      { status: 200 }
    );
  }

  // 2) Fallback: current user may have twitter_username = segment but username not set yet (e.g. claim failed or not run).
  const { data: myProfile, error: myError } = await supabase
    .from("profiles")
    .select("id, username, twitter_username, published")
    .eq("id", user.id)
    .maybeSingle();

  if (!myError && myProfile) {
    const row = myProfile as { username?: string | null; twitter_username?: string | null; published?: boolean };
    const twitterNorm = (row.twitter_username ?? "").trim().toLowerCase().replace(/^@/, "");
    if (twitterNorm === segment) {
      return NextResponse.json(
        { isOwner: true, status: row.published === true ? "published" : "unpublished" },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ isOwner: false }, { status: 200 });
}
