/**
 * GET /api/kol-lists/[id] — get list and members
 * PATCH /api/kol-lists/[id] — update list
 * DELETE /api/kol-lists/[id] — delete list
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  const { data: list, error: listError } = await supabase
    .from("kol_lists")
    .select("id, name, description, status, owner_type, owner_id, created_at, updated_at")
    .eq("id", id)
    .single();
  if (listError || !list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: members, error: memError } = await supabase
    .from("kol_list_members")
    .select("id, profile_id, notes, sort_order, created_at, shortlisted")
    .eq("kol_list_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (memError) return NextResponse.json({ error: memError.message }, { status: 500 });

  const profileIds = [...new Set((members ?? []).map((m: { profile_id: string }) => m.profile_id))];
  let profiles: Record<string, { username: string | null; display_name: string | null; avatar_url: string | null }> = {};
  if (profileIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", profileIds);
    for (const p of profs ?? []) {
      const row = p as { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
      profiles[row.id] = { username: row.username, display_name: row.display_name, avatar_url: row.avatar_url };
    }
  }
  const membersWithProfile = (members ?? []).map((m: { id: string; profile_id: string; notes: string | null; sort_order: number; created_at: string; shortlisted?: boolean }) => ({
    id: m.id,
    profile_id: m.profile_id,
    notes: m.notes,
    sort_order: m.sort_order,
    created_at: m.created_at,
    shortlisted: !!(m as { shortlisted?: boolean }).shortlisted,
    username: profiles[m.profile_id]?.username ?? null,
    display_name: profiles[m.profile_id]?.display_name ?? null,
    avatar_url: profiles[m.profile_id]?.avatar_url ?? null,
  }));

  return NextResponse.json({
    list: { ...list, members_count: membersWithProfile.length },
    members: membersWithProfile,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  if (body.status === "archived" || body.status === "active") updates.status = body.status;
  if (Object.keys(updates).length === 0) return fail("No updates", 400);

  const { data, error } = await supabase.from("kol_lists").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ list: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { error } = await supabase.from("kol_lists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
