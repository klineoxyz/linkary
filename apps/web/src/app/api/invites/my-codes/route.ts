/**
 * GET /api/invites/my-codes — list invite codes issued by the current user (profile) or by orgs they belong to.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  const { data: orgRows } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);
  const orgIds = (orgRows ?? []).map((r: { org_id: string }) => r.org_id);

  const [profileRes, orgRes] = await Promise.all([
    supabase
      .from("invite_codes")
      .select("id, code, status, batch_id, issued_by_type, issued_by_id, created_at, expires_at")
      .eq("issued_by_type", "profile")
      .eq("issued_by_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    orgIds.length > 0
      ? supabase
          .from("invite_codes")
          .select("id, code, status, batch_id, issued_by_type, issued_by_id, created_at, expires_at")
          .eq("issued_by_type", "org")
          .in("issued_by_id", orgIds)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [] as any[], error: null },
  ]);
  if (profileRes.error) return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  if (orgRes.error) return NextResponse.json({ error: orgRes.error.message }, { status: 500 });
  const merged = [...(profileRes.data ?? []), ...(orgRes.data ?? [])];
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return NextResponse.json({ codes: merged.slice(0, 200) });
}
