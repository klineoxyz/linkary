/**
 * GET /api/spaces/audience-overlaps?space_id=<uuid>
 * Returns other Spaces (only from registered users) with ≥30% audience overlap.
 * Both hosts must be registered (our space host = current user; other space host = any profile in DB).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { audienceOverlapPercent } from "@/lib/x-analytics-server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MIN_OVERLAP_PCT = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ overlaps: [] });
  }

  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get("space_id")?.trim();
  if (!spaceId) {
    return NextResponse.json({ overlaps: [] });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ overlaps: [] });
  }

  const { data: space } = await supabase
    .from("spaces")
    .select("id, host_profile_id")
    .eq("id", spaceId)
    .maybeSingle();
  const spaceRow = space as { id: string; host_profile_id: string } | null;
  if (!spaceRow || spaceRow.host_profile_id !== user.id) {
    return NextResponse.json({ overlaps: [] });
  }

  const { data: myParticipants } = await supabase
    .from("space_participants")
    .select("x_user_id")
    .eq("space_id", spaceId);
  const myIds = (myParticipants ?? []).map(
    (r: { x_user_id: string }) => r.x_user_id
  );
  if (myIds.length === 0) {
    return NextResponse.json({ overlaps: [] });
  }

  const { data: otherSpaces } = await supabase
    .from("spaces")
    .select("id, host_profile_id, title, scheduled_at, x_space_id")
    .neq("id", spaceId)
    .not("x_space_id", "is", null);
  const others = (otherSpaces ?? []) as Array<{
    id: string;
    host_profile_id: string;
    title: string;
    scheduled_at: string | null;
    x_space_id: string | null;
  }>;

  const overlaps: Array<{
    space_id: string;
    host_profile_id: string;
    host_username: string | null;
    title: string;
    scheduled_at: string | null;
    overlap_pct: number;
  }> = [];

  for (const other of others) {
    const { data: otherParticipants } = await supabase
      .from("space_participants")
      .select("x_user_id")
      .eq("space_id", other.id);
    const otherIds = (otherParticipants ?? []).map(
      (r: { x_user_id: string }) => r.x_user_id
    );
    if (otherIds.length === 0) continue;
    const pct = audienceOverlapPercent(myIds, otherIds);
    if (pct < MIN_OVERLAP_PCT) continue;
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, twitter_username")
      .eq("id", other.host_profile_id)
      .maybeSingle();
    const profileRow = profile as {
      username?: string | null;
      twitter_username?: string | null;
    } | null;
    const display =
      profileRow?.username ??
      profileRow?.twitter_username ??
      null;
    overlaps.push({
      space_id: other.id,
      host_profile_id: other.host_profile_id,
      host_username: display,
      title: other.title,
      scheduled_at: other.scheduled_at,
      overlap_pct: pct,
    });
  }

  return NextResponse.json({ overlaps });
}
