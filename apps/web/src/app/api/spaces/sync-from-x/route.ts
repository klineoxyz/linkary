/**
 * POST /api/spaces/sync-from-x
 * Body: { space_id?: string, space_url?: string, url?: string }
 * Fetches Space detail (twitterapi.io or X API v2 from x_oauth_tokens), verifies user is host,
 * then creates or updates our space. Returns 409 ALREADY_IMPORTED with existing space when already owned by user.
 * Never returns tokens.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseXSpaceId } from "@/lib/parseXSpaceId";
import {
  fetchXSpaceDetail,
  fetchXSpaceByIdV2,
  spaceParticipantIds,
  type XSpaceDetail,
} from "@/lib/x-analytics-server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TWITTERAPI_API_KEY = process.env.TWITTERAPI_API_KEY;

type SpaceRow = {
  id: string;
  host_profile_id: string;
  title: string;
  x_title: string | null;
  linkary_title: string | null;
  description: string | null;
  scheduled_at: string | null;
  duration_mins: number | null;
  status: string;
  created_at: string;
  x_space_id: string | null;
  x_space_url: string | null;
};

function toScheduledAt(scheduledStart: string | null | undefined): string | null {
  if (!scheduledStart) return null;
  const d = new Date(scheduledStart);
  return !isNaN(d.getTime()) ? d.toISOString() : null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  let body: { space_id?: string; space_url?: string; url?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const urlInput = typeof body.url === "string" ? body.url.trim() : typeof body.space_url === "string" ? body.space_url.trim() : "";
  let spaceId = typeof body.space_id === "string" ? body.space_id.trim() : null;
  if (!spaceId && urlInput) spaceId = parseXSpaceId(urlInput);
  if (!spaceId) {
    if (urlInput) {
      return NextResponse.json({ error: "Invalid X Space link", code: "INVALID_URL" }, { status: 400 });
    }
    return NextResponse.json({ error: "space_id or url required", code: "MISSING_INPUT" }, { status: 400 });
  }

  const xSpaceUrl = `https://x.com/i/spaces/${spaceId}`;

  const { data: existing } = await supabase
    .from("spaces")
    .select("id, host_profile_id, title, x_title, linkary_title, description, scheduled_at, duration_mins, status, created_at, x_space_id, x_space_url")
    .eq("x_space_id", spaceId)
    .maybeSingle();
  const existingRow = existing as SpaceRow | null;

  if (existingRow && existingRow.host_profile_id === user.id) {
    return NextResponse.json(
      { error: "This Space is already imported.", code: "ALREADY_IMPORTED", space: mapSpace(existingRow) },
      { status: 409 }
    );
  }
  if (existingRow && existingRow.host_profile_id !== user.id) {
    return NextResponse.json(
      { error: "This Space is already claimed by another user.", code: "SPACE_OWNED_BY_OTHER" },
      { status: 409 }
    );
  }

  let title = "X Space";
  let scheduledAt: string | null = null;
  let detail: XSpaceDetail | null = null;
  let useParticipantSync = false;

  if (TWITTERAPI_API_KEY) {
    detail = await fetchXSpaceDetail(spaceId, TWITTERAPI_API_KEY);
    if (detail) {
      const creatorHandle = (detail.creator?.userName ?? "").toString().trim().replace(/^@/, "").toLowerCase();
      if (!creatorHandle) {
        return NextResponse.json({ error: "Space creator could not be determined" }, { status: 400 });
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
      const myHandle = (social?.username ?? "").toString().trim().replace(/^@/, "").toLowerCase();
      if (myHandle !== creatorHandle) {
        return NextResponse.json({ error: "You can only sync Spaces you host on X" }, { status: 403 });
      }
      title = typeof detail.title === "string" ? detail.title.trim() : title;
      scheduledAt = toScheduledAt(detail.scheduled_start ?? undefined);
      useParticipantSync = true;
    }
  }

  if (!detail) {
    const { data: tokenRow } = await supabase
      .from("x_oauth_tokens")
      .select("access_token, x_user_id")
      .eq("profile_id", user.id)
      .eq("provider", "x")
      .maybeSingle();
    const accessToken = (tokenRow as { access_token?: string } | null)?.access_token;
    const xUserId = (tokenRow as { x_user_id?: string | null } | null)?.x_user_id;
    if (!accessToken || !xUserId) {
      return NextResponse.json({ error: "Connect X first to import Spaces", code: "X_NOT_CONNECTED" }, { status: 403 });
    }
    const v2Space = await fetchXSpaceByIdV2(spaceId, accessToken);
    if (!v2Space) {
      return NextResponse.json({ error: "Could not fetch Space from X" }, { status: 404 });
    }
    const hostIds = Array.isArray(v2Space.host_ids) ? v2Space.host_ids : [];
    if (!hostIds.includes(xUserId)) {
      return NextResponse.json({ error: "You can only import Spaces you host on X" }, { status: 403 });
    }
    title = typeof v2Space.title === "string" && v2Space.title.trim() ? v2Space.title.trim() : title;
    scheduledAt = toScheduledAt(v2Space.scheduled_start);
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertErr } = await supabase
    .from("spaces")
    .insert({
      host_profile_id: user.id,
      title,
      x_title: title,
      linkary_title: null,
      description: null,
      scheduled_at: scheduledAt,
      duration_mins: 60,
      status: "scheduled",
      x_space_id: spaceId,
      x_space_url: xSpaceUrl,
      updated_at: now,
    })
    .select("id, host_profile_id, title, x_title, linkary_title, description, scheduled_at, duration_mins, status, created_at, x_space_id, x_space_url")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  const space = inserted as SpaceRow;

  if (useParticipantSync && detail) {
    const participantIds = spaceParticipantIds(detail);
    const snapshotAt = new Date().toISOString();
    const source = "twitterapi.io";
    await supabase.from("space_participants").delete().eq("space_id", space.id);
    for (const xUserId of participantIds) {
      const role =
        detail.participants?.admins?.some((a) => (a.id ?? a.userName) === xUserId)
          ? "admin"
          : detail.participants?.speakers?.some((s) => (s.id ?? s.userName) === xUserId)
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
  }

  return NextResponse.json({
    space: mapSpace(space),
    participants_count: useParticipantSync && detail ? spaceParticipantIds(detail).length : 0,
  });
}

function mapSpace(row: SpaceRow) {
  return {
    id: row.id,
    host_profile_id: row.host_profile_id,
    title: row.title,
    x_title: row.x_title ?? row.title,
    linkary_title: row.linkary_title ?? null,
    description: row.description,
    scheduled_at: row.scheduled_at,
    duration_mins: row.duration_mins,
    status: row.status,
    created_at: row.created_at,
    x_space_id: row.x_space_id,
    x_space_url: row.x_space_url ?? null,
  };
}
