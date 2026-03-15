/**
 * POST /api/case-studies — create a profile-owned case study.
 * Optional deal_id (org deal) or gig_deal_id: links case study to verified work. Caller must be a party to the deal.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";
import { sanitizeUrl } from "@/lib/sanitizeUrl";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const profileId = getProfileIdForAuthUser(user.id);

  let body: {
    title?: string;
    description?: string;
    proof_url?: string;
    is_public?: boolean;
    deal_id?: string;
    gig_deal_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  let dealId: string | null = typeof body.deal_id === "string" ? body.deal_id.trim() || null : null;
  let gigDealId: string | null = typeof body.gig_deal_id === "string" ? body.gig_deal_id.trim() || null : null;
  if (dealId && gigDealId) return fail("BAD_REQUEST", "Provide at most one of deal_id or gig_deal_id", 400);

  if (dealId) {
    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .select("id, profile_id, org_id, status")
      .eq("id", dealId)
      .maybeSingle();
    if (dealErr || !deal) return fail("NOT_FOUND", "Deal not found", 404);
    const d = deal as { profile_id: string; org_id: string };
    if (d.profile_id !== profileId) {
      const { data: membership } = await supabase
        .from("org_members")
        .select("role")
        .eq("org_id", d.org_id)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!membership || !["owner", "admin"].includes((membership as { role: string }).role)) {
        return fail("FORBIDDEN", "Only a party to this deal can link a case study", 403);
      }
    }
  }

  if (gigDealId) {
    const { data: gigDeal, error: gErr } = await supabase
      .from("gig_deals")
      .select("id, owner_profile_id, participant_profile_id")
      .eq("id", gigDealId)
      .maybeSingle();
    if (gErr || !gigDeal) return fail("NOT_FOUND", "Gig deal not found", 404);
    const g = gigDeal as { owner_profile_id: string; participant_profile_id: string };
    if (g.owner_profile_id !== profileId && g.participant_profile_id !== profileId) {
      return fail("FORBIDDEN", "Only a party to this deal can link a case study", 403);
    }
  }

  const proofUrl = typeof body.proof_url === "string" && body.proof_url.trim()
    ? sanitizeUrl(body.proof_url.trim()) ?? null
    : null;

  const { data: row, error } = await supabase
    .from("case_studies")
    .insert({
      owner_type: "profile",
      owner_profile_id: profileId,
      owner_org_id: null,
      title: typeof body.title === "string" ? body.title.trim() || null : null,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      proof_url: proofUrl,
      metrics: {},
      is_public: typeof body.is_public === "boolean" ? body.is_public : true,
      deal_id: dealId || null,
      gig_deal_id: gigDealId || null,
    })
    .select("id, title, description, proof_url, is_public, deal_id, gig_deal_id, created_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ caseStudy: row }, { status: 201 });
}
