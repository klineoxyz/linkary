/**
 * GET /api/xspaces/[id]/rsvps — return RSVP counts and attendee list for a space (from space_rsvps).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const spaceId = (await params).id;
  if (!spaceId || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
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
  const profileIds = [...new Set(list.map((r) => r.profile_id))];
  let attendees: Array<{ profile_id: string; status: string; username?: string | null }> = list.map((r) => ({ ...r, username: null }));

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", profileIds);
    const byId = new Map((profiles ?? []).map((p) => [(p as { id: string }).id, (p as { username: string | null }).username]));
    attendees = list.map((r) => ({ ...r, username: byId.get(r.profile_id) ?? null }));
  }

  return NextResponse.json({
    total: list.length,
    going_count: going.length,
    interested_count: interested.length,
    attendees,
  });
}
