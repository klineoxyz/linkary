/**
 * POST /api/deals/[id]/complete — set gig_deal status to completed (owner only).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: deal, error: fetchErr } = await supabase
    .from("gig_deals")
    .select("id, owner_profile_id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return fail("DB_ERROR", fetchErr.message, 500);
  if (!deal) return fail("NOT_FOUND", "Deal not found", 404);
  if ((deal as { owner_profile_id: string }).owner_profile_id !== ownerProfileId) {
    return fail("FORBIDDEN", "Only the deal owner can complete it", 403);
  }
  const status = (deal as { status: string }).status;
  if (status !== "active") return fail("BAD_REQUEST", `Deal is ${status}, cannot complete`, 400);

  const { data: updated, error: updateErr } = await supabase
    .from("gig_deals")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateErr) return fail("DB_ERROR", updateErr.message, 500);
  return ok({ deal: updated });
}
