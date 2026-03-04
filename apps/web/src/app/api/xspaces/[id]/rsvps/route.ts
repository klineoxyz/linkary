/**
 * GET /api/xspaces/[id]/rsvps — RSVP counts always; attendee list by role:
 * - Host: full list with usernames.
 * - Logged-in non-host: counts + limited list (first 5, username only).
 * - Anonymous: counts only (no attendees).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const LIMIT_NON_HOST = 5;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const spaceId = (await params).id;
  if (!spaceId || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {});

  const { data: spaceRow } = await supabase
    .from("spaces")
    .select("host_profile_id")
    .eq("id", spaceId)
    .maybeSingle();
  const hostProfileId = (spaceRow as { host_profile_id?: string } | null)?.host_profile_id ?? null;

  let currentUserId: string | null = null;
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    currentUserId = user?.id ?? null;
  }

  const isHost = !!currentUserId && currentUserId === hostProfileId;

  const { data: rows, error } = await supabase
    .from("space_rsvps")
    .select("profile_id, status")
    .eq("space_id", spaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (rows ?? []) as Array<{ profile_id: string; status: string }>;
  const going = list.filter((r) => r.status === "going");
  const interested = list.filter((r) => r.status === "interested");

  const payload: {
    total: number;
    going_count: number;
    interested_count: number;
    attendees?: Array<{ profile_id: string; status: string; username?: string | null }>;
  } = {
    total: list.length,
    going_count: going.length,
    interested_count: interested.length,
  };

  if (list.length === 0) {
    return NextResponse.json(payload);
  }

  if (!currentUserId) {
    return NextResponse.json(payload);
  }

  const listToShow = isHost ? list : list.slice(0, LIMIT_NON_HOST);
  const profileIds = [...new Set(listToShow.map((r) => r.profile_id))];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", profileIds);
  const byId = new Map((profiles ?? []).map((p) => [(p as { id: string }).id, (p as { username: string | null }).username]));

  payload.attendees = listToShow.map((r) => ({ ...r, username: byId.get(r.profile_id) ?? null }));

  return NextResponse.json(payload);
}
