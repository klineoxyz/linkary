/**
 * PATCH /api/spaces/[id]/sponsor-proposals/[proposalId] — host accept or decline.
 * Accept requires: status: "accepted", payout_method, payout_wallet_address (when not linkary_wallet).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PAYOUT_METHODS = ["saved_wallet", "one_time_wallet", "linkary_wallet"] as const;
const WALLET_ADDRESS_MAX_LEN = 200;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const { id: spaceId, proposalId } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: space } = await supabase.from("spaces").select("id, host_profile_id").eq("id", spaceId).maybeSingle();
  const spaceRow = space as { host_profile_id?: string } | null;
  if (!spaceRow || spaceRow.host_profile_id !== user.id) {
    return NextResponse.json({ error: "Only the space host can accept or decline sponsor proposals" }, { status: 403 });
  }

  const { data: proposal } = await supabase
    .from("space_sponsor_proposals")
    .select("id, space_id, status")
    .eq("id", proposalId)
    .eq("space_id", spaceId)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  const currentStatus = (proposal as { status: string }).status;
  if (currentStatus !== "pending") {
    if (currentStatus === "accepted") return NextResponse.json({ error: "This proposal was already accepted." }, { status: 400 });
    if (currentStatus === "declined") return NextResponse.json({ error: "This proposal was already declined." }, { status: 400 });
    return NextResponse.json({ error: "Proposal is not pending" }, { status: 400 });
  }

  let body: { status?: string; payout_method?: string; payout_wallet_address?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status === "accepted" ? "accepted" : body.status === "declined" ? "declined" : null;
  if (!status) return NextResponse.json({ error: "status must be accepted or declined" }, { status: 400 });

  if (status === "declined") {
    const { data, error } = await supabase
      .from("space_sponsor_proposals")
      .update({ status: "declined", updated_at: new Date().toISOString() })
      .eq("id", proposalId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const payoutMethod = typeof body.payout_method === "string" && PAYOUT_METHODS.includes(body.payout_method as typeof PAYOUT_METHODS[number])
    ? body.payout_method
    : null;
  if (!payoutMethod) {
    return NextResponse.json({ error: "payout_method required when accepting (saved_wallet, one_time_wallet, or linkary_wallet)" }, { status: 400 });
  }
  let payoutWalletAddress: string | null = null;
  if (payoutMethod !== "linkary_wallet") {
    const trimmed = typeof body.payout_wallet_address === "string" ? body.payout_wallet_address.trim() : "";
    if (!trimmed) return NextResponse.json({ error: "payout_wallet_address required for saved_wallet and one_time_wallet" }, { status: 400 });
    payoutWalletAddress = trimmed.slice(0, WALLET_ADDRESS_MAX_LEN) || null;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("space_sponsor_proposals")
    .update({
      status: "accepted",
      payout_method: payoutMethod,
      payout_wallet_address: payoutWalletAddress,
      accepted_at: now,
      accepted_by_profile_id: user.id,
      updated_at: now,
    })
    .eq("id", proposalId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
