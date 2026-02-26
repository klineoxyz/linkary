/**
 * PATCH: Update an org team member (profile owner only).
 * DELETE: Delete an org team member (profile owner only).
 */
import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function assertOwnership(supabase: SupabaseClient, id: string, userId: string): Promise<{ org_profile_id: string } | ReturnType<typeof fail>> {
  const { data, error } = await supabase
    .from("org_team_members")
    .select("org_profile_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { org_profile_id: string } | null;
  if (!row) return fail("NOT_FOUND", "Team member not found", 404);
  if (row.org_profile_id !== userId) return fail("FORBIDDEN", "You can only edit your own profile's team.", 403);
  return row;
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

  const ownership = await assertOwnership(supabase, id, user.id);
  if (ownership && "code" in ownership) return ownership;

  let body: {
    name?: string;
    role?: string | null;
    avatar_url?: string | null;
    linkedin_url?: string | null;
    x_url?: string | null;
    website_url?: string | null;
    is_public?: boolean;
  };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (name) updates.name = name;
  }
  if (body?.role !== undefined) updates.role = typeof body.role === "string" ? body.role.trim() || null : null;
  if (body?.avatar_url !== undefined) updates.avatar_url = typeof body.avatar_url === "string" ? body.avatar_url.trim() || null : null;
  if (body?.linkedin_url !== undefined) updates.linkedin_url = typeof body.linkedin_url === "string" ? body.linkedin_url.trim() || null : null;
  if (body?.x_url !== undefined) updates.x_url = typeof body.x_url === "string" ? body.x_url.trim() || null : null;
  if (body?.website_url !== undefined) updates.website_url = typeof body.website_url === "string" ? body.website_url.trim() || null : null;
  if (typeof body?.is_public === "boolean") updates.is_public = body.is_public;

  const { data: row, error } = await supabase
    .from("org_team_members")
    .update(updates)
    .eq("id", id)
    .select("id, name, role, avatar_url, linkedin_url, x_url, website_url, is_public, sort_order, created_at, updated_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ member: row });
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

  const ownership = await assertOwnership(supabase, id, user.id);
  if (ownership && "code" in ownership) return ownership;

  const { error } = await supabase.from("org_team_members").delete().eq("id", id);
  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ deleted: true });
}
