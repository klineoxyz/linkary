/**
 * PATCH: Update a profile achievement. DELETE: Delete a profile achievement.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 280;

function isValidUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("https://") || t.startsWith("http://");
}

async function assertOwnership(supabase: SupabaseClient, id: string, profileId: string): Promise<NextResponse | null> {
  const { data, error } = await supabase.from("profile_achievements").select("profile_id").eq("id", id).maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { profile_id: string } | null;
  if (!row) return fail("NOT_FOUND", "Achievement not found", 404);
  if (row.profile_id !== profileId) return fail("FORBIDDEN", "You can only edit your own achievements.", 403);
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

  let body: { title?: string; description?: string | null; url?: string | null; is_public?: boolean };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.title === "string") {
    const title = body.title.trim().slice(0, TITLE_MAX);
    if (!title) return fail("BAD_REQUEST", "title cannot be empty", 400);
    updates.title = title;
  }
  if (body?.description !== undefined) {
    updates.description = typeof body.description === "string" ? body.description.trim().slice(0, DESCRIPTION_MAX) || null : null;
  }
  if (body?.url !== undefined) {
    if (body.url === null || body.url === "") updates.proof_url = null;
    else if (typeof body.url === "string") {
      const u = body.url.trim();
      if (!isValidUrl(u)) return fail("BAD_REQUEST", "url must start with https:// or http://", 400);
      updates.proof_url = u;
    }
  }
  if (typeof body?.is_public === "boolean") updates.is_public = body.is_public;

  const { data: row, error } = await supabase
    .from("profile_achievements")
    .update(updates)
    .eq("id", id)
    .select("id, title, description, proof_url, is_public, sort_order, created_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  const out = { ...row, url: (row as { proof_url?: string | null }).proof_url ?? null };
  return ok({ achievement: out });
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

  const { error } = await supabase.from("profile_achievements").delete().eq("id", id);
  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ deleted: true });
}
