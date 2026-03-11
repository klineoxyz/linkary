/**
 * POST /api/creator-programs/[id]/invites — add invite(s). Body: { profile_id: string } or { profile_ids: string[] }, optional source_type, source_id
 * PATCH /api/creator-programs/[id]/invites — update invite status. Body: { profile_id: string, status: string } (invitee can set accepted/declined)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: programId } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  let body: { profile_id?: string; profile_ids?: string[]; source_type?: string; source_id?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const profileIds = body.profile_ids ?? (body.profile_id ? [body.profile_id] : []);
  if (profileIds.length === 0) return fail("profile_id or profile_ids required", 400);
  const sourceType = ["circle", "kol_list", "manual"].includes(body.source_type ?? "") ? body.source_type : "manual";

  const inserted: any[] = [];
  for (const profileId of profileIds) {
    if (!profileId || typeof profileId !== "string") continue;
    const { data: row, error } = await supabase
      .from("creator_program_invites")
      .insert({
        creator_program_id: programId,
        profile_id: profileId,
        source_type: sourceType,
        source_id: body.source_id ?? null,
        status: "invited",
      })
      .select("id, profile_id, status, invited_at")
      .single();
    if (error) {
      if (error.code === "23505") continue;
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted.push(row);
  }
  return NextResponse.json({ invites: inserted });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: programId } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  let body: { profile_id: string; status: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const { profile_id, status } = body;
  if (!profile_id || !status) return fail("profile_id and status required", 400);
  const validStatus = ["invited", "accepted", "declined", "applied", "active", "removed"].includes(status) ? status : null;
  if (!validStatus) return fail("Invalid status", 400);

  const { data: row, error } = await supabase
    .from("creator_program_invites")
    .update({ status: validStatus })
    .eq("creator_program_id", programId)
    .eq("profile_id", profile_id)
    .select("id, profile_id, status, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ invite: row });
}
