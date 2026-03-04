/**
 * POST /api/spaces/sync-from-x
 * Body: { space_id?: string, space_url?: string }
 * Fetches Space detail from Twitter (twitterapi.io), verifies creator matches current user's X handle,
 * then creates or updates our space and stores participants for audience-overlap (only when both hosts are registered).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseXSpaceId } from "@/lib/parseXSpaceId";
import {
  fetchXSpaceDetail,
  spaceParticipantIds,
} from "@/lib/x-analytics-server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TWITTERAPI_API_KEY = process.env.TWITTERAPI_API_KEY;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!TWITTERAPI_API_KEY) {
    return NextResponse.json({ error: "X Spaces sync not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { space_id?: string; space_url?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  let spaceId =
    typeof body.space_id === "string" ? body.space_id.trim() : null;
  if (!spaceId && typeof body.space_url === "string") {
    spaceId = parseXSpaceId(body.space_url);
  }
  if (!spaceId) {
    const hasUrl = typeof body.space_url === "string" && body.space_url.trim().length > 0;
    return NextResponse.json(
      {
        ok: false,
        code: hasUrl ? "INVALID_SPACE_URL" : "MISSING_INPUT",
        message: hasUrl ? "Invalid X Space URL. Use a link like https://x.com/i/spaces/..." : "space_id or space_url required",
      },
      { status: 400 }
    );
  }

  const detail = await fetchXSpaceDetail(spaceId, TWITTERAPI_API_KEY);
  if (!detail) {
    return NextResponse.json(
      { error: "Could not fetch Space from X" },
      { status: 404 }
    );
  }

  const creatorHandle = (detail.creator?.userName ?? "")
    .toString()
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (!creatorHandle) {
    return NextResponse.json(
      { error: "Space creator could not be determined" },
      { status: 400 }
    );
  }

  const { data: social } = await supabase
    .from("social_accounts")
    .select("username")
    .eq("user_id", user.id)
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();
  const myHandle = (social?.username ?? "")
    .toString()
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (myHandle !== creatorHandle) {
    return NextResponse.json(
      { error: "You can only sync Spaces you host on X" },
      { status: 403 }
    );
  }

  const title =
    typeof detail.title === "string" ? detail.title.trim() : "X Space";
  const scheduledStart = detail.scheduled_start
    ? new Date(detail.scheduled_start)
    : null;
  const scheduledAt =
    scheduledStart && !isNaN(scheduledStart.getTime())
      ? scheduledStart.toISOString()
      : null;

  const { data: existing } = await supabase
    .from("spaces")
    .select("id, host_profile_id")
    .eq("x_space_id", spaceId)
    .maybeSingle();
  const existingRow = existing as { id: string; host_profile_id: string } | null;

  if (existingRow && existingRow.host_profile_id !== user.id) {
    return NextResponse.json(
      {
        ok: false,
        code: "SPACE_OWNED_BY_OTHER",
        message: "This Space is already claimed by another user.",
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  let space: {
    id: string;
    host_profile_id: string;
    title: string;
    description: string | null;
    scheduled_at: string | null;
    duration_mins: number | null;
    status: string;
    created_at: string;
    x_space_id: string | null;
  };

  if (existingRow) {
    const { data: updated, error: updateErr } = await supabase
      .from("spaces")
      .update({
        title,
        scheduled_at: scheduledAt,
        updated_at: now,
      })
      .eq("id", existingRow.id)
      .select("id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at, x_space_id")
      .single();
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    space = updated as typeof space;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("spaces")
      .insert({
        host_profile_id: user.id,
        title,
        description: null,
        scheduled_at: scheduledAt,
        duration_mins: 60,
        status: "scheduled",
        x_space_id: spaceId,
        updated_at: now,
      })
      .select("id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at, x_space_id")
      .single();
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    space = inserted as typeof space;
  }

  const participantIds = spaceParticipantIds(detail);
  const snapshotAt = new Date().toISOString();
  const source = "twitterapi.io";
  await supabase.from("space_participants").delete().eq("space_id", space.id);
  for (const xUserId of participantIds) {
    const role =
      detail.participants?.admins?.some(
        (a) => (a.id ?? a.userName) === xUserId
      )
        ? "admin"
        : detail.participants?.speakers?.some(
            (s) => (s.id ?? s.userName) === xUserId
          )
          ? "speaker"
          : "listener";
    await supabase.from("space_participants").insert({
      space_id: space.id,
      x_user_id: xUserId,
      role,
      snapshot_at: snapshotAt,
      source,
    });
  }

  return NextResponse.json({
    space: {
      id: space.id,
      host_profile_id: space.host_profile_id,
      title: space.title,
      description: space.description,
      scheduled_at: space.scheduled_at,
      duration_mins: space.duration_mins,
      status: space.status,
      created_at: space.created_at,
      x_space_id: space.x_space_id,
    },
    participants_count: participantIds.length,
  });
}
