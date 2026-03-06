/**
 * GET /api/xspaces/my-proposals — project-facing: sponsor proposals where project_profile_id = current user.
 * Returns display space title (linkary_title ?? x_title ?? title), status, offer, type, payout info, etc.
 * Sort: pending first, then accepted, then declined; within each group, most recent first.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const STATUS_ORDER: Record<string, number> = { pending: 0, accepted: 1, declined: 2 };

export async function GET(request: NextRequest) {
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
    .select("id, space_id, status, offer_amount, currency, sponsorship_type, message, requested_deliverables, payout_method, payout_wallet_address, accepted_at, created_at, updated_at")
    .eq("project_profile_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (rows ?? []) as Array<{
    id: string;
    space_id: string;
    status: string;
    offer_amount: number;
    currency: string;
    sponsorship_type: string;
    message: string | null;
    requested_deliverables: string | null;
    payout_method: string | null;
    payout_wallet_address: string | null;
    accepted_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  const spaceIds = [...new Set(list.map((r) => r.space_id))];
  if (spaceIds.length === 0) {
    return NextResponse.json({ proposals: [] });
  }

  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, title, x_title, linkary_title, host_profile_id")
    .in("id", spaceIds);

  type SpaceRow = { id: string; title?: string; x_title?: string | null; linkary_title?: string | null; host_profile_id?: string };
  const spaceById = new Map((spaces ?? []).map((s) => [(s as SpaceRow).id, s as SpaceRow]));

  const hostIds = [...new Set((spaces ?? []).map((s: SpaceRow) => s.host_profile_id).filter(Boolean) as string[])];
  let hostById = new Map<string, { display_name: string | null; username: string | null }>();
  if (hostIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name, username").in("id", hostIds);
    hostById = new Map((profiles ?? []).map((p: { id: string; display_name: string | null; username: string | null }) => [p.id, { display_name: p.display_name, username: p.username }]));
  }

  const proposals = list.map((r) => {
    const space = spaceById.get(r.space_id) as SpaceRow | undefined;
    const displayTitle = (space?.linkary_title?.trim() || space?.x_title?.trim() || space?.title) || "Space";
    const host = space?.host_profile_id ? hostById.get(space.host_profile_id) : undefined;
    return {
      id: r.id,
      space_id: r.space_id,
      space_display_title: displayTitle,
      host_profile_id: space?.host_profile_id ?? null,
      status: r.status,
      offer_amount: r.offer_amount,
      currency: r.currency,
      sponsorship_type: r.sponsorship_type,
      message: r.message,
      requested_deliverables: r.requested_deliverables,
      payout_method: r.payout_method,
      payout_wallet_address: r.payout_wallet_address,
      accepted_at: r.accepted_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      host_display_name: host?.display_name ?? null,
      host_username: host?.username ?? null,
    };
  });

  const sorted = [...proposals].sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] ?? 3;
    const orderB = STATUS_ORDER[b.status] ?? 3;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return NextResponse.json({ proposals: sorted });
}
