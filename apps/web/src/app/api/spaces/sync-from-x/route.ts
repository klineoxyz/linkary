/**
 * POST /api/spaces/sync-from-x
 * Body: { space_id?: string, space_url?: string, url?: string }
 * Fetches X Space detail from twitterapi.io only (GET /twitter/spaces/detail?space_id=<id>).
 * No official X API is used in this route. When provider key is not set, returns 503.
 * Verifies user is host via creator handle, then creates the space. Returns 409 when already owned.
 * Never returns tokens. One structured log per request (no secrets).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseXSpaceId } from "@/lib/parseXSpaceId";
import { sanitizeServerError, debugSync } from "@/lib/server-error";
import { spaceParticipantIds, type XSpaceDetail } from "@/lib/x-analytics-server";
import {
  fetchSpaceByIdFromTwitterApi,
  isTwitterApiSpacesConfigured,
} from "@/lib/xspaces-data-provider";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

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

/** One structured log per sync request. No secrets, tokens, or cookies. */
function logSyncOutcome(p: {
  parsed_space_id: string;
  provider_status: number | null;
  provider_code: string | null;
  final_app_status: number;
  final_app_code: string;
}) {
  const payload = {
    route: "sync-from-x",
    provider_used: "twitterapi.io",
    parsed_space_id: p.parsed_space_id,
    provider_status: p.provider_status,
    provider_code: p.provider_code,
    final_app_status: p.final_app_status,
    final_app_code: p.final_app_code,
    fallback_used: false,
  };
  // eslint-disable-next-line no-console
  console.warn("[sync-from-x] SYNC_OUTCOME", JSON.stringify(payload));
}

export async function POST(request: NextRequest) {
  debugSync("SYNC_STAGE_ROUTE_HIT");
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_INVALID" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user?.id) {
      debugSync("SYNC_STAGE_FAIL_AUTH", sanitizeServerError(userError));
      return NextResponse.json({ error: "Invalid session", code: "AUTH_INVALID" }, { status: 401 });
    }
    debugSync("SYNC_STAGE_AUTH_OK", user.id);

    let body: { space_id?: string; space_url?: string; url?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON", code: "SYNC_INVALID_INPUT" }, { status: 400 });
    }
    debugSync("SYNC_STAGE_BODY_OK");

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
      debugSync("SYNC_STAGE_ALREADY_IMPORTED");
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

    // This route uses twitterapi.io only. No official X API.
    if (!isTwitterApiSpacesConfigured()) {
      logSyncOutcome({
        parsed_space_id: spaceId,
        provider_status: null,
        provider_code: "PROVIDER_NOT_CONFIGURED",
        final_app_status: 503,
        final_app_code: "PROVIDER_NOT_CONFIGURED",
      });
      return NextResponse.json(
        { error: "Import from X is not configured. Try again later.", code: "PROVIDER_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    let title = "X Space";
    let scheduledAt: string | null = null;
    let detail: XSpaceDetail | null = null;
    let useParticipantSync = false;

    const providerResult = await fetchSpaceByIdFromTwitterApi(spaceId);
    const pStatus = "status" in providerResult ? providerResult.status : null;
    const pCode = "code" in providerResult ? providerResult.code : null;

    if (providerResult.ok) {
      detail = providerResult.data;
      const creatorHandle = (detail.creator?.userName ?? "").toString().trim().replace(/^@/, "").toLowerCase();
      if (!creatorHandle) {
        logSyncOutcome({
          parsed_space_id: spaceId,
          provider_status: pStatus ?? 200,
          provider_code: pCode ?? "OK",
          final_app_status: 400,
          final_app_code: "SYNC_INVALID_INPUT",
        });
        return NextResponse.json({ error: "Space creator could not be determined", code: "SYNC_INVALID_INPUT" }, { status: 400 });
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
        logSyncOutcome({
          parsed_space_id: spaceId,
          provider_status: pStatus ?? 200,
          provider_code: pCode ?? "OK",
          final_app_status: 403,
          final_app_code: "X_NOT_HOST",
        });
        return NextResponse.json({ error: "You can only sync Spaces you host on X", code: "X_NOT_HOST" }, { status: 403 });
      }
      title = typeof detail.title === "string" ? detail.title.trim() : title;
      scheduledAt = toScheduledAt(detail.scheduled_start ?? undefined);
      useParticipantSync = true;
    } else {
      const code = "code" in providerResult ? providerResult.code : "PROVIDER_UNAVAILABLE";
      if (code === "PROVIDER_NOT_CONFIGURED") {
        logSyncOutcome({
          parsed_space_id: spaceId,
          provider_status: pStatus,
          provider_code: code,
          final_app_status: 503,
          final_app_code: "PROVIDER_NOT_CONFIGURED",
        });
        return NextResponse.json(
          { error: "Import from X is not configured. Try again later.", code: "PROVIDER_NOT_CONFIGURED" },
          { status: 503 }
        );
      }
      if (code === "SPACE_NOT_FOUND") {
        // eslint-disable-next-line no-console
        console.warn("[xspaces] sync_space_not_found");
        logSyncOutcome({
          parsed_space_id: spaceId,
          provider_status: pStatus,
          provider_code: code,
          final_app_status: 404,
          final_app_code: "SPACE_NOT_FOUND",
        });
        return NextResponse.json({
          error: "This Space could not be found by the current X data provider. It may be unavailable, private, deleted, or not yet indexed. If this is a scheduled Space, it may not be in the provider's index yet; try again closer to start time or after it has started.",
          code: "SPACE_NOT_FOUND",
        }, { status: 404 });
      }
      if (code === "PROVIDER_AUTH_FAILED") {
        logSyncOutcome({
          parsed_space_id: spaceId,
          provider_status: pStatus,
          provider_code: code,
          final_app_status: 502,
          final_app_code: "PROVIDER_AUTH_FAILED",
        });
        return NextResponse.json(
          { error: "The X data provider rejected the request. Try again later.", code: "PROVIDER_AUTH_FAILED" },
          { status: 502 }
        );
      }
      if (code === "PROVIDER_RATE_LIMITED" || code === "PROVIDER_QUOTA_EXHAUSTED") {
        logSyncOutcome({
          parsed_space_id: spaceId,
          provider_status: pStatus,
          provider_code: code,
          final_app_status: 429,
          final_app_code: code,
        });
        return NextResponse.json(
          { error: "The X data provider quota is currently exhausted. Try again later.", code },
          { status: 429 }
        );
      }
      if (code === "PROVIDER_TIMEOUT") {
        logSyncOutcome({
          parsed_space_id: spaceId,
          provider_status: pStatus,
          provider_code: code,
          final_app_status: 502,
          final_app_code: "PROVIDER_TIMEOUT",
        });
        return NextResponse.json(
          { error: "The X data provider is temporarily unavailable. Try again.", code: "PROVIDER_TIMEOUT" },
          { status: 502 }
        );
      }
      if (code === "PROVIDER_INVALID_RESPONSE") {
        logSyncOutcome({
          parsed_space_id: spaceId,
          provider_status: pStatus,
          provider_code: code,
          final_app_status: 502,
          final_app_code: "PROVIDER_INVALID_RESPONSE",
        });
        return NextResponse.json(
          { error: "Invalid response from X data provider. Try again.", code: "PROVIDER_INVALID_RESPONSE" },
          { status: 502 }
        );
      }
      logSyncOutcome({
        parsed_space_id: spaceId,
        provider_status: pStatus,
        provider_code: code,
        final_app_status: 502,
        final_app_code: "PROVIDER_UNAVAILABLE",
      });
      return NextResponse.json(
        { error: "The X data provider is temporarily unavailable. Try again.", code: "PROVIDER_UNAVAILABLE" },
        { status: 502 }
      );
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
      debugSync("SYNC_STAGE_FAIL_INSERT", sanitizeServerError(insertErr));
      logSyncOutcome({
        parsed_space_id: spaceId,
        provider_status: pStatus ?? 200,
        provider_code: pCode ?? "OK",
        final_app_status: 502,
        final_app_code: "SYNC_INTERNAL_ERROR",
      });
      return NextResponse.json(
        { error: "Failed to create space. Try again.", code: "SYNC_INTERNAL_ERROR" },
        { status: 502 }
      );
    }
    const space = inserted as SpaceRow;
    debugSync("SYNC_STAGE_INSERT_OK", space.id);

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

    logSyncOutcome({
      parsed_space_id: spaceId,
      provider_status: 200,
      provider_code: "OK",
      final_app_status: 200,
      final_app_code: "OK",
    });
    return NextResponse.json({
      space: mapSpace(space),
      participants_count: useParticipantSync && detail ? spaceParticipantIds(detail).length : 0,
    });
  } catch (err) {
    const msg = (() => {
      try {
        return sanitizeServerError(err);
      } catch {
        return "Sync failed.";
      }
    })();
    debugSync("SYNC_STAGE_FAIL_INTERNAL", msg);
    return NextResponse.json(
      { error: "Import failed. Try again.", code: "SYNC_INTERNAL_ERROR" },
      { status: 502 }
    );
  }
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
