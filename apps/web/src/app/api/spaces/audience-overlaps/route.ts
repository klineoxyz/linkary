/**
 * GET /api/spaces/audience-overlaps?space_id=<uuid>
 * Returns other Spaces (from registered users) with audience overlap.
 * No minimum % filter. Top 10 sorted by overlap_percent desc.
 * Response: overlap_percent, overlap_count, min_audience_size.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { audienceOverlapCount } from "@/lib/x-analytics-server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TOP_N = 10;
const CACHE_SECONDS = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ overlaps: [] });
  }

  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get("space_id")?.trim();
  const debug = searchParams.get("debug") === "1";
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
    const res = NextResponse.json({ overlaps: [] });
    res.headers.set("Cache-Control", `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate`);
    return res;
  }

  const { data: otherSpaces } = await supabase
    .from("spaces")
    .select("id, host_profile_id, title, linkary_title, scheduled_at, x_space_id")
    .neq("id", spaceId)
    .not("x_space_id", "is", null);
  const others = (otherSpaces ?? []) as Array<{
    id: string;
    host_profile_id: string;
    title: string;
    linkary_title?: string | null;
    scheduled_at: string | null;
    x_space_id: string | null;
  }>;

  const overlaps: Array<{
    other_space_id: string;
    other_space_title: string;
    other_host_username: string | null;
    overlap_percent: number;
    overlap_count: number;
    min_audience_size: number;
    overlap_percent_raw?: number;
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
    const overlapCount = audienceOverlapCount(myIds, otherIds);
    const minSize = Math.min(myIds.length, otherIds.length);
    const pctRaw = minSize === 0 ? 0 : (overlapCount / minSize) * 100;
    const pct = Math.round(pctRaw * 10) / 10;
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
    const item: (typeof overlaps)[number] = {
      other_space_id: other.id,
      other_space_title: (other.linkary_title?.trim() || other.title) ?? other.title,
      other_host_username: display,
      overlap_percent: pct,
      overlap_count: overlapCount,
      min_audience_size: minSize,
    };
    if (debug) item.overlap_percent_raw = Math.round(pctRaw * 10000) / 10000;
    overlaps.push(item);
  }

  overlaps.sort((a, b) => b.overlap_percent - a.overlap_percent);
  const top = overlaps.slice(0, TOP_N);

  const res = NextResponse.json({ overlaps: top });
  res.headers.set("Cache-Control", `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate`);
  return res;
}
