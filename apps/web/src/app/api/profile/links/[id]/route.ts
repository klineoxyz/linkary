/**
 * PATCH: Update a profile link (owner only).
 * DELETE: Delete a profile link (owner only).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TITLE_MIN = 1;
const TITLE_MAX = 60;
const ICON_MAX = 32;

function isValidUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("https://") || t.startsWith("http://");
}

async function assertOwnership(
  supabase: SupabaseClient,
  id: string,
  profileId: string
): Promise<NextResponse | { profile_id: string }> {
  const { data, error } = await supabase
    .from("profile_links")
    .select("profile_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { profile_id: string } | null;
  if (!row) return fail("NOT_FOUND", "Link not found", 404);
  if (row.profile_id !== profileId) return fail("FORBIDDEN", "You can only edit your own links.", 403);
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

  const profileId = getProfileIdForAuthUser(user.id);
  const ownership = await assertOwnership(supabase, id, profileId);
  if (ownership instanceof NextResponse) return ownership;

  let body: { title?: string; url?: string; icon?: string | null; is_public?: boolean };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      return fail("BAD_REQUEST", `Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters`, 400);
    }
    updates.title = title;
  }
  if (typeof body?.url === "string") {
    const url = body.url.trim();
    if (!isValidUrl(url)) return fail("BAD_REQUEST", "URL must start with https:// or http://", 400);
    updates.url = url;
  }
  if (body?.icon !== undefined) {
    updates.icon = typeof body.icon === "string" ? body.icon.trim().slice(0, ICON_MAX) || null : null;
  }
  if (typeof body?.is_public === "boolean") updates.is_public = body.is_public;

  const { data: row, error } = await supabase
    .from("profile_links")
    .update(updates)
    .eq("id", id)
    .select("id, title, url, icon, is_public, sort_order, created_at, updated_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ link: row });
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

  const profileId = getProfileIdForAuthUser(user.id);
  const ownership = await assertOwnership(supabase, id, profileId);
  if (ownership instanceof NextResponse) return ownership;

  const { error } = await supabase.from("profile_links").delete().eq("id", id);
  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ deleted: true });
}
