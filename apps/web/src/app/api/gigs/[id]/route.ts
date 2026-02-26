/**
 * PATCH /api/gigs/[id] — update gig (owner only)
 * DELETE /api/gigs/[id] — delete gig (owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const GIG_TYPES = ["ambassador", "affiliate", "ugc", "marketing", "partnership", "other"] as const;
const COMP_TYPES = ["paid", "revshare", "token", "equity", "unpaid", "other"] as const;

async function assertOwner(supabase: SupabaseClient, gigId: string, ownerProfileId: string): Promise<NextResponse | null> {
  const { data, error } = await supabase.from("gigs").select("owner_profile_id").eq("id", gigId).maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { owner_profile_id: string } | null;
  if (!row) return fail("NOT_FOUND", "Gig not found", 404);
  if (row.owner_profile_id !== ownerProfileId) return fail("FORBIDDEN", "Not your gig", 403);
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
  const ownerProfileId = getProfileIdForAuthUser(user.id);
  const err = await assertOwner(supabase, id, ownerProfileId);
  if (err) return err;

  let body: { title?: string; description?: string; gig_type?: string; compensation_type?: string; budget_text?: string | null; location?: string | null; remote?: boolean; is_public?: boolean };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.title === "string") updates.title = body.title.trim();
  if (typeof body?.description === "string") updates.description = body.description.trim();
  if (typeof body?.gig_type === "string" && GIG_TYPES.includes(body.gig_type as typeof GIG_TYPES[number])) updates.gig_type = body.gig_type;
  if (typeof body?.compensation_type === "string" && COMP_TYPES.includes(body.compensation_type as typeof COMP_TYPES[number])) updates.compensation_type = body.compensation_type;
  if (body?.budget_text !== undefined) updates.budget_text = typeof body.budget_text === "string" ? body.budget_text.trim() || null : null;
  if (body?.location !== undefined) updates.location = typeof body.location === "string" ? body.location.trim() || null : null;
  if (typeof body?.remote === "boolean") updates.remote = body.remote;
  if (typeof body?.is_public === "boolean") updates.is_public = body.is_public;

  if (Object.keys(updates).length <= 1) {
    const { data: existing } = await supabase.from("gigs").select("*").eq("id", id).single();
    if (existing) return ok({ gig: existing });
    return fail("NOT_FOUND", "Gig not found", 404);
  }

  const { data: row, error } = await supabase.from("gigs").update(updates).eq("id", id).select().single();
  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ gig: row });
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
  const ownerProfileId = getProfileIdForAuthUser(user.id);
  const err = await assertOwner(supabase, id, ownerProfileId);
  if (err) return err;

  const { error } = await supabase.from("gigs").delete().eq("id", id);
  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ deleted: true });
}
