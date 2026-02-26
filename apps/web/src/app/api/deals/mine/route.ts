/**
 * GET /api/deals/mine — list gig_deals where current user is owner or participant.
 * Returns gig title + counterparty (username, display_name, avatar_url, profile_type) and status.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(_request: NextRequest) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const myProfileId = getProfileIdForAuthUser(user.id);

  const { data: rows, error } = await supabase
    .from("gig_deals")
    .select("id, gig_id, owner_profile_id, participant_profile_id, status, created_at, updated_at")
    .or(`owner_profile_id.eq.${myProfileId},participant_profile_id.eq.${myProfileId}`)
    .order("created_at", { ascending: false });

  if (error) return fail("DB_ERROR", error.message, 500);
  const deals = (rows ?? []) as Array<{
    id: string;
    gig_id: string;
    owner_profile_id: string;
    participant_profile_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;

  const gigIds = [...new Set(deals.map((d) => d.gig_id))];
  const counterpartyIds = [...new Set(deals.map((d) => (d.owner_profile_id === myProfileId ? d.participant_profile_id : d.owner_profile_id)))];

  let gigsById: Record<string, { title: string }> = {};
  if (gigIds.length > 0) {
    const { data: gigs } = await supabase.from("gigs").select("id, title").in("id", gigIds);
    for (const g of (gigs ?? []) as Array<{ id: string; title: string }>) {
      gigsById[g.id] = { title: g.title };
    }
  }

  let profilesById: Record<string, { username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string | null }> = {};
  if (counterpartyIds.length > 0) {
    const { data: profs } = await supabase
      .from("public_profile_view")
      .select("id, username, display_name, avatar_url, profile_type")
      .in("id", counterpartyIds);
    for (const p of (profs ?? []) as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string | null }>) {
      profilesById[p.id] = p;
    }
  }

  const list = deals.map((d) => {
    const counterpartyId = d.owner_profile_id === myProfileId ? d.participant_profile_id : d.owner_profile_id;
    const profile = profilesById[counterpartyId];
    const gig = gigsById[d.gig_id];
    return {
      id: d.id,
      gig_id: d.gig_id,
      gig_title: gig?.title ?? null,
      status: d.status,
      created_at: d.created_at,
      updated_at: d.updated_at,
      is_owner: d.owner_profile_id === myProfileId,
      counterparty: profile
        ? {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            profile_type: profile.profile_type,
          }
        : null,
    };
  });

  return ok({ deals: list });
}
