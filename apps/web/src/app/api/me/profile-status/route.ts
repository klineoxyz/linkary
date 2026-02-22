import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/me/profile-status?username=xxx
 * Auth required. Returns { status: 'not_found' | 'unpublished' | 'published' }.
 * Only reveals 'unpublished' when the current user owns that username (prevents enumeration).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ status: "not_found" }, { status: 200 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ status: "not_found" }, { status: 200 });
  }

  const username = request.nextUrl.searchParams.get("username");
  const segment = (username ?? "").trim().toLowerCase().replace(/^@/, "");
  if (!segment) {
    return NextResponse.json({ status: "not_found" }, { status: 200 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, published")
    .ilike("username", segment)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ status: "not_found" }, { status: 200 });
  }

  if ((profile as { id: string }).id !== user.id) {
    return NextResponse.json({ status: "not_found" }, { status: 200 });
  }

  const published = (profile as { published?: boolean }).published === true;
  return NextResponse.json(
    { status: published ? "published" : "unpublished" },
    { status: 200 }
  );
}
