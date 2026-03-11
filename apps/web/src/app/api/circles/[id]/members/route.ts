/**
 * POST /api/circles/[id]/members — add profile_id (body: profile_id, notes?)
 * DELETE /api/circles/[id]/members?profile_id= — remove member
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: circleId } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  let body: { profile_id: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const profileId = body?.profile_id;
  if (!profileId || typeof profileId !== "string") return fail("profile_id required", 400);

  const { data: row, error } = await supabase
    .from("circle_members")
    .insert({
      circle_id: circleId,
      profile_id: profileId,
      added_by: user.id,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("id, profile_id, notes, created_at")
    .single();
  if (error) {
    if (error.code === "23505") return fail("Already in circle", 409);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ member: row });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: circleId } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  const profileId = request.nextUrl.searchParams.get("profile_id");
  if (!profileId) return fail("profile_id required", 400);

  const { error } = await supabase
    .from("circle_members")
    .delete()
    .eq("circle_id", circleId)
    .eq("profile_id", profileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
