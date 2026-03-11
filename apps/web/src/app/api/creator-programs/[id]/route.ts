/**
 * GET /api/creator-programs/[id] — get program and invites
 * PATCH /api/creator-programs/[id] — update program
 * DELETE /api/creator-programs/[id] — delete program
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

  const { data: program, error: progErr } = await supabase
    .from("creator_programs")
    .select("id, org_id, title, description, program_type, status, created_at, updated_at")
    .eq("id", id)
    .single();
  if (progErr || !program) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: invites, error: invErr } = await supabase
    .from("creator_program_invites")
    .select("id, profile_id, source_type, source_id, status, invited_at, updated_at")
    .eq("creator_program_id", id)
    .order("invited_at", { ascending: false });
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  const profileIds = [...new Set((invites ?? []).map((i: { profile_id: string }) => i.profile_id))];
  let profiles: Record<string, { username: string | null; display_name: string | null }> = {};
  if (profileIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, username, display_name").in("id", profileIds);
    for (const p of profs ?? []) {
      const row = p as { id: string; username: string | null; display_name: string | null };
      profiles[row.id] = { username: row.username, display_name: row.display_name };
    }
  }
  const invitesWithProfile = (invites ?? []).map((i: any) => ({
    ...i,
    username: profiles[i.profile_id]?.username ?? null,
    display_name: profiles[i.profile_id]?.display_name ?? null,
  }));

  return NextResponse.json({ program: { ...program, invites_count: invitesWithProfile.length }, invites: invitesWithProfile });
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
  if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  if (["ambassador", "affiliate", "campaign", "other"].includes(body.program_type as string)) updates.program_type = body.program_type;
  if (["draft", "open", "closed", "archived"].includes(body.status as string)) updates.status = body.status;
  if (Object.keys(updates).length === 0) return fail("No updates", 400);

  const { data, error } = await supabase.from("creator_programs").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ program: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { error } = await supabase.from("creator_programs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
