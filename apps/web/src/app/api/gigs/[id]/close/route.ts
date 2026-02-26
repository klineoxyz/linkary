/**
 * POST /api/gigs/[id]/close — set gig status to closed (owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function assertOwner(supabase: SupabaseClient, gigId: string, ownerProfileId: string): Promise<NextResponse | null> {
  const { data, error } = await supabase.from("gigs").select("owner_profile_id").eq("id", gigId).maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { owner_profile_id: string } | null;
  if (!row) return fail("NOT_FOUND", "Gig not found", 404);
  if (row.owner_profile_id !== ownerProfileId) return fail("FORBIDDEN", "Not your gig", 403);
  return null;
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: row, error } = await supabase
    .from("gigs")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ gig: row });
}
