/**
 * PATCH: Update a profile skill. DELETE: Delete a profile skill.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const NAME_MAX = 40;
const LEVEL_MIN = 1;
const LEVEL_MAX = 5;

async function assertOwnership(supabase: SupabaseClient, id: string, profileId: string): Promise<NextResponse | null> {
  const { data, error } = await supabase.from("profile_skills").select("profile_id").eq("id", id).maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { profile_id: string } | null;
  if (!row) return fail("NOT_FOUND", "Skill not found", 404);
  if (row.profile_id !== profileId) return fail("FORBIDDEN", "You can only edit your own skills.", 403);
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const { id } = await params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);
  const profileId = getProfileIdForAuthUser(user.id);
  const err = await assertOwnership(supabase, id, profileId);
  if (err) return err;

  let body: { name?: string; level?: number | null; is_public?: boolean };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.name === "string") {
    const name = body.name.trim().slice(0, NAME_MAX);
    if (!name) return fail("BAD_REQUEST", "name cannot be empty", 400);
    updates.name = name;
  }
  if (body?.level !== undefined) {
    if (body.level === null) updates.level = null;
    else if (typeof body.level === "number" && Number.isFinite(body.level)) {
      const n = Math.round(body.level);
      if (n >= LEVEL_MIN && n <= LEVEL_MAX) updates.level = n;
    }
  }
  if (typeof body?.is_public === "boolean") updates.is_public = body.is_public;

  const { data: row, error } = await supabase
    .from("profile_skills")
    .update(updates)
    .eq("id", id)
    .select("id, name, level, is_public, sort_order, created_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ skill: row });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const { id } = await params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);
  const profileId = getProfileIdForAuthUser(user.id);
  const err = await assertOwnership(supabase, id, profileId);
  if (err) return err;

  const { error } = await supabase.from("profile_skills").delete().eq("id", id);
  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ deleted: true });
}
