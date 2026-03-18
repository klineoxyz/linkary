/**
 * PATCH/DELETE /api/orgs/[orgId]/sourcing/saved-views/[viewId]
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertOrgMember(supabase: any, orgId: string, userId: string) {
  const { data } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; viewId: string }> }
) {
  const { orgId, viewId } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  if (!(await assertOrgMember(supabase, orgId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: { name?: string; filters?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (!n || n.length > 120) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    patch.name = n;
  }
  if (body.filters && typeof body.filters === "object") patch.filters = body.filters;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "name or filters required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("org_sourcing_saved_views")
    .update(patch)
    .eq("id", viewId)
    .eq("org_id", orgId)
    .select("id, org_id, name, filters, created_at, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ view: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string; viewId: string }> }
) {
  const { orgId, viewId } = await params;
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  if (!(await assertOrgMember(supabase, orgId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await supabase.from("org_sourcing_saved_views").delete().eq("id", viewId).eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
