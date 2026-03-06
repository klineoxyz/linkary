/**
 * GET /api/spaces/[id]/sponsor-proposals — list proposals for a space. Host sees all; project sees own (RLS).
 * POST /api/spaces/[id]/sponsor-proposals — create proposal (authenticated; project_profile_id = current user).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SPONSORSHIP_TYPES = ["title_sponsor", "co_sponsor", "giveaway_sponsor", "speaking_slot_sponsor", "custom"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const spaceId = (await params).id;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: rows, error } = await supabase
    .from("space_sponsor_proposals")
    .select("id, project_profile_id, offer_amount, currency, sponsorship_type, message, requested_deliverables, status, payout_method, accepted_at, created_at, updated_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (rows ?? []) as Array<{
    id: string;
    project_profile_id: string;
    offer_amount: number;
    currency: string;
    sponsorship_type: string;
    message: string | null;
    requested_deliverables: string | null;
    status: string;
    payout_method: string | null;
    accepted_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  const profileIds = [...new Set(list.map((r) => r.project_profile_id))];
  type ProfileRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
  let withProfiles = list.map((r) => ({ ...r, username: null as string | null, display_name: null as string | null, avatar_url: null as string | null }));

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", profileIds);
    const byId = new Map((profiles ?? []).map((p) => [(p as ProfileRow).id, p as ProfileRow]));
    withProfiles = list.map((r) => {
      const p = byId.get(r.project_profile_id);
      return { ...r, username: p?.username ?? null, display_name: p?.display_name ?? null, avatar_url: p?.avatar_url ?? null };
    });
  }

  return NextResponse.json({ proposals: withProfiles });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const spaceId = (await params).id;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: space } = await supabase.from("spaces").select("id, host_profile_id").eq("id", spaceId).maybeSingle();
  if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 });
  if ((space as { host_profile_id: string }).host_profile_id === user.id) {
    return NextResponse.json({ error: "Host cannot submit a sponsor proposal to their own space" }, { status: 400 });
  }

  let body: { offer_amount?: number; currency?: string; sponsorship_type?: string; message?: string; requested_deliverables?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const offerAmount = typeof body.offer_amount === "number" ? body.offer_amount : Number(body.offer_amount);
  if (!Number.isFinite(offerAmount) || offerAmount <= 0) {
    return NextResponse.json({ error: "Offer amount must be greater than 0", code: "INVALID_OFFER" }, { status: 400 });
  }
  if (offerAmount >= 1_000_000) {
    return NextResponse.json({ error: "Offer amount must be less than 1,000,000", code: "INVALID_OFFER" }, { status: 400 });
  }
  const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().slice(0, 10) : "USD";
  const sponsorshipType = typeof body.sponsorship_type === "string" && SPONSORSHIP_TYPES.includes(body.sponsorship_type as typeof SPONSORSHIP_TYPES[number])
    ? body.sponsorship_type
    : "custom";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) || null : null;
  const requestedDeliverables = typeof body.requested_deliverables === "string" ? body.requested_deliverables.trim().slice(0, 2000) || null : null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("space_sponsor_proposals")
    .insert({
      space_id: spaceId,
      project_profile_id: user.id,
      offer_amount: offerAmount,
      currency,
      sponsorship_type: sponsorshipType,
      message,
      requested_deliverables: requestedDeliverables,
      status: "pending",
      updated_at: now,
    })
    .select("id, space_id, project_profile_id, offer_amount, currency, sponsorship_type, message, requested_deliverables, status, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You already have a pending proposal for this space", code: "DUPLICATE_PENDING" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
