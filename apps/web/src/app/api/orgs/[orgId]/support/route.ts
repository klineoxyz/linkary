import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST: Current user (profile) supports the org. Idempotent. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const orgId = (await params).orgId;
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { error } = await supabase
    .from("org_supporters")
    .upsert({ org_id: orgId, profile_id: user.id }, { onConflict: "org_id,profile_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const { refreshOrgInfluenceRollup } = await import("@/lib/refreshOrgInfluence");
    await refreshOrgInfluenceRollup(orgId);
  } catch (_) {
    /* non-blocking */
  }
  return NextResponse.json({ ok: true });
}
