/**
 * GET/POST /api/orgs/[orgId]/sourcing/saved-views — org members only.
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

export async function GET(
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
  if (userError || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  if (!(await assertOrgMember(supabase, orgId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await supabase
    .from("org_sourcing_saved_views")
    .select("id, org_id, name, filters, created_at, updated_at")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ views: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const orgId = (await params).orgId;
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
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "name required (max 120 chars)" }, { status: 400 });
  }
  const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
  const { data, error } = await supabase
    .from("org_sourcing_saved_views")
    .insert({
      org_id: orgId,
      name,
      filters,
      created_by: user.id,
    })
    .select("id, org_id, name, filters, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ view: data });
}
