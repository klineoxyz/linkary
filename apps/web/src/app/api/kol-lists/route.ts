/**
 * GET /api/kol-lists — list KOL lists for current user (profile) or ?owner=org&org_id=...
 * POST /api/kol-lists — create KOL list (body: name, description?, owner_type, owner_id, status?)
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

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner") ?? "profile";
  const orgId = searchParams.get("org_id");

  if (owner === "org" && orgId) {
    const { data: rows, error } = await supabase
      .from("kol_lists")
      .select("id, name, description, status, created_at, updated_at")
      .eq("owner_type", "org")
      .eq("owner_id", orgId)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const withCounts = await Promise.all(
      (rows ?? []).map(async (r: { id: string }) => {
        const { count } = await supabase
          .from("kol_list_members")
          .select("id", { count: "exact", head: true })
          .eq("kol_list_id", r.id);
        return { ...r, members_count: count ?? 0, owner_type: "org" as const, owner_id: orgId };
      })
    );
    return NextResponse.json({ lists: withCounts });
  }

  const { data: rows, error } = await supabase
    .from("kol_lists")
    .select("id, name, description, status, created_at, updated_at")
    .eq("owner_type", "profile")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const withCounts = await Promise.all(
    (rows ?? []).map(async (r: { id: string }) => {
      const { count } = await supabase
        .from("kol_list_members")
        .select("id", { count: "exact", head: true })
        .eq("kol_list_id", r.id);
      return { ...r, members_count: count ?? 0, owner_type: "profile" as const, owner_id: user.id };
    })
  );
  return NextResponse.json({ lists: withCounts });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  let body: { name: string; description?: string; owner_type: "profile" | "org"; owner_id: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const { name, owner_type, owner_id } = body;
  if (!name || typeof name !== "string" || !name.trim()) return fail("name required", 400);
  if (owner_type === "profile" && owner_id !== user.id) return fail("Forbidden", 403);
  if (owner_type === "org") {
    const { data: mem } = await supabase.from("org_members").select("role").eq("org_id", owner_id).eq("user_id", user.id).maybeSingle();
    if (!mem) return fail("Not a member of this org", 403);
  }

  const { data: row, error } = await supabase
    .from("kol_lists")
    .insert({
      owner_type: owner_type || "profile",
      owner_id: owner_id || user.id,
      name: name.trim(),
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      status: body.status === "archived" ? "archived" : "active",
    })
    .select("id, name, description, status, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ot = (body.owner_type || "profile") as "profile" | "org";
  const oid = body.owner_id || user.id;
  return NextResponse.json({ list: { ...row, members_count: 0, owner_type: ot, owner_id: oid } });
}
