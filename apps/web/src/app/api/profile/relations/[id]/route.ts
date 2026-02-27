/**
 * PATCH: Update is_public, sort_order (owner only).
 * DELETE: Delete relation (owner only).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function assertOwnership(
  supabase: SupabaseClient,
  id: string,
  sourceProfileId: string
): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from("profile_relations")
    .select("source_profile_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { source_profile_id: string } | null;
  if (!row) return fail("NOT_FOUND", "Relation not found", 404);
  if (row.source_profile_id !== sourceProfileId) return fail("FORBIDDEN", "You can only edit your own relations.", 403);
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  const { id } = await params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);

  const sourceProfileId = getProfileIdForAuthUser(user.id);
  const err = await assertOwnership(supabase, id, sourceProfileId);
  if (err) return err;

  let body: { is_public?: boolean; sort_order?: number };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.is_public === "boolean") updates.is_public = body.is_public;
  if (typeof body?.sort_order === "number") updates.sort_order = body.sort_order;

  if (Object.keys(updates).length <= 1) {
    const { data: existing } = await supabase.from("profile_relations").select("*").eq("id", id).single();
    if (existing) return ok({ relation: existing });
    return fail("NOT_FOUND", "Relation not found", 404);
  }

  const { data: row, error } = await supabase
    .from("profile_relations")
    .update(updates)
    .eq("id", id)
    .select("id, source_profile_id, target_profile_id, relation_type, is_public, sort_order, created_at, updated_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  try {
    const r = row as { source_profile_id?: string; target_profile_id?: string };
    if (r?.source_profile_id && r?.target_profile_id) {
      const { createServiceSupabase } = await import("@/lib/x-analytics-server");
      const { recomputeRepForProfiles } = await import("@/lib/repScore");
      await recomputeRepForProfiles([r.source_profile_id, r.target_profile_id], createServiceSupabase());
    }
  } catch {
    /* non-fatal */
  }
  return ok({ relation: row });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  const { id } = await params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);

  const sourceProfileId = getProfileIdForAuthUser(user.id);
  const err = await assertOwnership(supabase, id, sourceProfileId);
  if (err) return err;

  const { data: rel } = await supabase.from("profile_relations").select("source_profile_id, target_profile_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("profile_relations").delete().eq("id", id);
  if (error) return fail("DB_ERROR", error.message, 500);
  if (rel) {
    const r = rel as { source_profile_id: string; target_profile_id: string };
    try {
      const { createServiceSupabase } = await import("@/lib/x-analytics-server");
      const { recomputeRepForProfiles } = await import("@/lib/repScore");
      await recomputeRepForProfiles([r.source_profile_id, r.target_profile_id], createServiceSupabase());
    } catch {
      /* non-fatal */
    }
  }
  return ok({ deleted: true });
}
