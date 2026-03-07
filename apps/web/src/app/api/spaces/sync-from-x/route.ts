/**
 * POST /api/spaces/sync-from-x
 * Body: { space_id?: string, space_url?: string, url?: string }
 * Fetches Space detail from the intended provider: twitterapi.io when configured (no X API fallback);
 * otherwise official X API v2 from x_oauth_tokens. Verifies user is host, then creates or updates our space.
 * Returns 409 ALREADY_IMPORTED with existing space when already owned by user.
 * Never returns tokens. Deterministic error codes; 502 for upstream failures (not 404).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseXSpaceId } from "@/lib/parseXSpaceId";
import { sanitizeServerError, debugSync } from "@/lib/server-error";
import {
  fetchXSpaceByIdV2,
  spaceParticipantIds,
  type XSpaceDetail,
} from "@/lib/x-analytics-server";
import { refreshXAccessToken } from "@/lib/x-token-refresh";
import {
  fetchSpaceByIdFromTwitterApi,
  isTwitterApiSpacesConfigured,
} from "@/lib/xspaces-data-provider";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

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

  let title = "X Space";
  let scheduledAt: string | null = null;
  let detail: XSpaceDetail | null = null;
  let useParticipantSync = false;

  if (isTwitterApiSpacesConfigured()) {
    // Always-on production verification: proves which provider was used (no secrets logged).
    // eslint-disable-next-line no-console
    console.warn("[sync-from-x] PROVIDER_PATH=twitterapi.io");
    const providerResult = await fetchSpaceByIdFromTwitterApi(spaceId);
    const normalizedPastedUrl = (() => {
      if (!urlInput) return "space_id_only";
      try {
        const u = new URL(urlInput.trim().startsWith("http") ? urlInput.trim() : `https://${urlInput.trim()}`);
        return `${u.hostname}${u.pathname}`;
      } catch {
        return "invalid_url";
      }
    })();
    const pStatus = "status" in providerResult ? providerResult.status : null;
    const pCode = "code" in providerResult ? providerResult.code : null;
    const pMessage = "message" in providerResult ? providerResult.message : undefined;
    const pData = providerResult.ok && providerResult.data ? providerResult.data : null;
    const syncVerifyPayload = {
      normalized_pasted_url: normalizedPastedUrl,
      parsed_space_id: spaceId,
      provider_used: "twitterapi.io",
      endpoint_path: "/twitter/spaces/detail",
      sanitized_query_params: { space_id: spaceId },
      provider_status: pStatus,
      provider_code: pCode,
      provider_message: pMessage ?? undefined,
      data_id: pData?.id ?? undefined,
      data_state: pData?.state ?? undefined,
      data_scheduled_start: pData?.scheduled_start ?? undefined,
      fallback_used: false,
    };
    // eslint-disable-next-line no-console
    console.warn("[sync-from-x] PROVIDER_VERIFY", JSON.stringify(syncVerifyPayload));
    const debugSyncFromX = process.env.DEBUG_SYNC_FROM_X === "1" || process.env.DEBUG_SYNC_FROM_X === "true";
    if (debugSyncFromX) {
      debugSync("SYNC_PROVIDER_USED", "twitterapi.io");
      debugSync("SYNC_PROVIDER_RESULT", JSON.stringify(providerResult.ok ? { ok: true } : { ok: false, code: providerResult.code, status: "status" in providerResult ? providerResult.status : null }));
    }
    if (providerResult.ok) {
      detail = providerResult.data;
      const creatorHandle = (detail.creator?.userName ?? "").toString().trim().replace(/^@/, "").toLowerCase();
      if (!creatorHandle) {
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
        return NextResponse.json({ error: "You can only sync Spaces you host on X", code: "X_NOT_HOST" }, { status: 403 });
      }
      title = typeof detail.title === "string" ? detail.title.trim() : title;
      scheduledAt = toScheduledAt(detail.scheduled_start ?? undefined);
      useParticipantSync = true;
    } else {
      const code = "code" in providerResult ? providerResult.code : "PROVIDER_UNAVAILABLE";
      if (code === "PROVIDER_NOT_CONFIGURED") {
        return NextResponse.json({ error: "Import from X is not configured. Try again later.", code: "PROVIDER_NOT_CONFIGURED" }, { status: 503 });
      }
      if (code === "SPACE_NOT_FOUND") {
        // eslint-disable-next-line no-console
        console.warn("[xspaces] sync_space_not_found");
        return NextResponse.json({ error: "This Space could not be found by the current X data provider. It may be unavailable, private, deleted, or not yet indexed.", code: "SPACE_NOT_FOUND" }, { status: 404 });
      }
      if (code === "PROVIDER_AUTH_FAILED") {
        return NextResponse.json({ error: "The X data provider rejected the request. Try again later.", code: "PROVIDER_AUTH_FAILED" }, { status: 502 });
      }
      if (code === "PROVIDER_RATE_LIMITED" || code === "PROVIDER_QUOTA_EXHAUSTED") {
        return NextResponse.json({ error: "The X data provider quota is currently exhausted. Try again later.", code }, { status: 429 });
      }
      if (code === "PROVIDER_TIMEOUT") {
        return NextResponse.json({ error: "The X data provider is temporarily unavailable. Try again.", code: "PROVIDER_TIMEOUT" }, { status: 502 });
      }
      if (code === "PROVIDER_INVALID_RESPONSE") {
        return NextResponse.json({ error: "Invalid response from X data provider. Try again.", code: "PROVIDER_INVALID_RESPONSE" }, { status: 502 });
      }
      return NextResponse.json({ error: "The X data provider is temporarily unavailable. Try again.", code: "PROVIDER_UNAVAILABLE" }, { status: 502 });
    }
  }

  if (!detail) {
    // Always-on production verification: sync-from-x using X API when provider key not set.
    // eslint-disable-next-line no-console
    console.warn("[sync-from-x] PROVIDER_PATH=x_api");
    const { data: tokenRow, error: tokenError } = await supabase
      .from("x_oauth_tokens")
      .select("access_token, refresh_token, x_user_id")
      .eq("profile_id", user.id)
      .eq("provider", "x")
      .maybeSingle();
    if (tokenError) {
      debugSync("SYNC_STAGE_FAIL_TOKEN_LOOKUP", tokenError.message);
      return NextResponse.json({ error: "Connect X first to import Spaces", code: "X_NOT_CONNECTED" }, { status: 403 });
    }
    const hasTokenRow = !!tokenRow;
    const accessToken = (tokenRow as { access_token?: string } | null)?.access_token;
    const refreshToken = (tokenRow as { refresh_token?: string | null } | null)?.refresh_token;
    const xUserId = (tokenRow as { x_user_id?: string | null } | null)?.x_user_id;
    debugSync("SYNC_STAGE_TOKEN_ROW", JSON.stringify({ token_row_exists: hasTokenRow, access_token_exists: !!accessToken, refresh_token_exists: !!refreshToken, x_user_id_exists: !!xUserId }));
    if (!accessToken || !xUserId) {
      debugSync("SYNC_STAGE_FAIL_X_NOT_CONNECTED", tokenRow ? "missing access_token or x_user_id" : "no token row");
      return NextResponse.json({ error: "Connect X first to import Spaces", code: "X_NOT_CONNECTED" }, { status: 403 });
    }
    debugSync("SYNC_STAGE_TOKEN_ROW_FOUND");
    const fields = "title,state,created_at,scheduled_start,host_ids";
    debugSync("X_API_CALL_START", JSON.stringify({
      endpoint: `https://api.twitter.com/2/spaces/${spaceId}?space.fields=${fields}`,
      access_token_exists: true,
      x_user_id_exists: true,
    }));
    let v2Space: { id: string; title?: string; state?: string; created_at?: string; scheduled_start?: string; host_ids?: string[] } | null = null;
    let currentAccessToken = accessToken;
    let result = await fetchXSpaceByIdV2(spaceId, currentAccessToken);
    const xHttpStatusFirst = result.space ? 200 : (result.xStatus ?? 0);
    let refreshAttempt = 0;
    let refreshSuccess = false;
    let tokenPersistSuccess = false;
    let retryAttempt = 0;
    let xHttpStatusRetry: number | null = null;
    const needsReconnect = !result.space && (result.xStatus === 401 || result.xStatus === 403);
    if (needsReconnect && refreshToken && supabaseServiceKey && supabaseUrl) {
      refreshAttempt = 1;
      debugSync("SYNC_STAGE_REFRESH_ATTEMPT", "1");
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
      const refreshed = await refreshXAccessToken(user.id, supabaseService);
      refreshSuccess = !!refreshed?.access_token;
      tokenPersistSuccess = refreshSuccess;
      if (refreshed?.access_token) {
        retryAttempt = 1;
        debugSync("SYNC_STAGE_RETRY_ATTEMPT", "1");
        currentAccessToken = refreshed.access_token;
        result = await fetchXSpaceByIdV2(spaceId, currentAccessToken);
        xHttpStatusRetry = result.space ? 200 : (result.xStatus ?? 0);
      }
    }
    const finalCode = !result.space && result.code ? result.code : result.space ? "OK" : "X_API_FAILED";
    debugSync("PRODUCTION_VERIFY", JSON.stringify({
      provider: "x_api",
      token_row_exists: hasTokenRow,
      access_token_exists: !!accessToken,
      refresh_token_exists: !!refreshToken,
      x_user_id_exists: !!xUserId,
      x_http_status_first: xHttpStatusFirst,
      refresh_attempt: refreshAttempt,
      refresh_success: refreshSuccess,
      token_persist_success: tokenPersistSuccess,
      retry_attempt: retryAttempt,
      x_http_status_retry: xHttpStatusRetry,
      final_code: finalCode,
    }));
    debugSync("SYNC_STAGE_FINAL_CODE", finalCode);
    if (result.space) {
      v2Space = result.space;
    } else {
      if (result.xStatus === 401 || result.xStatus === 403 || result.code === "X_RECONNECT_NEEDED") {
        debugSync("SYNC_STAGE_FAIL_X_AUTH", String(result.xStatus ?? result.code));
        return NextResponse.json(
          { error: "X connection expired or invalid. Reconnect X in Settings or XSpaces.", code: "X_RECONNECT_NEEDED" },
          { status: 403 }
        );
      }
      if (result.xStatus === 429 || result.code === "X_RATE_LIMITED") {
        debugSync("SYNC_STAGE_FAIL_X_RATE_LIMITED");
        return NextResponse.json(
          { error: "X rate limit reached. Try again later.", code: "X_RATE_LIMITED" },
          { status: 429 }
        );
      }
      if (result.xStatus === 404 || result.code === "SPACE_NOT_FOUND") {
        debugSync("SYNC_STAGE_FAIL_SPACE_NOT_FOUND");
        // eslint-disable-next-line no-console
        console.warn("[xspaces] sync_space_not_found");
        return NextResponse.json(
          { error: "Space not found on X.", code: "SPACE_NOT_FOUND" },
          { status: 404 }
        );
      }
      if (result.code === "X_API_TIMEOUT") {
        debugSync("SYNC_STAGE_FAIL_X_API_TIMEOUT");
        return NextResponse.json(
          { error: "X API request timed out. Try again.", code: "X_API_TIMEOUT" },
          { status: 502 }
        );
      }
      debugSync("SYNC_STAGE_FAIL_X_NO_DATA", result.xStatus ? String(result.xStatus) : result.code ?? undefined);
      return NextResponse.json(
        { error: "Could not fetch Space from X. Try again.", code: "X_API_FAILED" },
        { status: 502 }
      );
    }
    debugSync("SYNC_STAGE_X_FETCH_OK");
    const hostIds = Array.isArray(v2Space.host_ids) ? v2Space.host_ids : [];
    if (!hostIds.includes(xUserId)) {
      return NextResponse.json({ error: "You can only import Spaces you host on X", code: "X_NOT_HOST" }, { status: 403 });
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
    debugSync("SYNC_STAGE_FAIL_INSERT", sanitizeServerError(insertErr));
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
