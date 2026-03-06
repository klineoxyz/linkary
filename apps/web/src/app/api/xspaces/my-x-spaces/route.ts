/**
 * GET /api/xspaces/my-x-spaces — list recent X Spaces for the connected user (X API v2 by creator).
 * Auth required; token from x_oauth_tokens. Returns normalized list (id, title, state, started_at, scheduled_start, url).
 * No tokens in response. Uses shared x-api-client; refresh-and-retry on 401/403 when refresh_token present.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sanitizeServerError, debugMyXSpaces } from "@/lib/server-error";
import { fetchSpacesByCreatorId } from "@/lib/x-analytics-server";
import { refreshXAccessToken } from "@/lib/x-token-refresh";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
const DAYS_AGO = 30;

export type MyXSpaceItem = {
  id: string;
  title: string | null;
  state: string | null;
  started_at: string | null;
  scheduled_start: string | null;
  url: string;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_INVALID" }, { status: 401 });
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    debugMyXSpaces("MY_X_SPACES_STAGE_FAIL_CONFIG", "Supabase env not set");
    return NextResponse.json(
      { error: "Service configuration error.", code: "MY_X_SPACES_INTERNAL_ERROR" },
      { status: 502 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user?.id) {
      debugMyXSpaces("MY_X_SPACES_STAGE_FAIL_AUTH", sanitizeServerError(userError));
      return NextResponse.json({ error: "Invalid session", code: "AUTH_INVALID" }, { status: 401 });
    }
    debugMyXSpaces("MY_X_SPACES_STAGE_AUTH_OK", user.id);

    const { data: tokenRow, error: tokenError } = await supabase
      .from("x_oauth_tokens")
      .select("access_token, refresh_token, x_user_id")
      .eq("profile_id", user.id)
      .eq("provider", "x")
      .maybeSingle();

    if (tokenError) {
      debugMyXSpaces("MY_X_SPACES_STAGE_FAIL_TOKEN_LOOKUP", tokenError.message);
      return NextResponse.json(
        { error: "Connect X first to see your Spaces", code: "X_NOT_CONNECTED" },
        { status: 403 }
      );
    }
    const hasTokenRow = !!tokenRow;
    const hasAccessToken = !!(tokenRow as { access_token?: string } | null)?.access_token;
    const hasRefreshToken = !!(tokenRow as { refresh_token?: string | null } | null)?.refresh_token;
    const xUserId = (tokenRow as { x_user_id?: string | null } | null)?.x_user_id;
    debugMyXSpaces("MY_X_SPACES_STAGE_TOKEN_ROW", JSON.stringify({ token_row_exists: hasTokenRow, access_token_exists: hasAccessToken, refresh_token_exists: hasRefreshToken, x_user_id_exists: !!xUserId }));
    if (!tokenRow || !hasAccessToken) {
      debugMyXSpaces("MY_X_SPACES_STAGE_FAIL_X_NOT_CONNECTED", !tokenRow ? "no token row" : "no access_token");
      return NextResponse.json(
        { error: "Connect X first to see your Spaces", code: "X_NOT_CONNECTED" },
        { status: 403 }
      );
    }
    if (!xUserId || typeof xUserId !== "string") {
      debugMyXSpaces("MY_X_SPACES_STAGE_FAIL_X_USER_ID_MISSING");
      return NextResponse.json(
        { error: "X user id not found. Reconnect X in Settings or XSpaces.", code: "X_USER_ID_MISSING" },
        { status: 403 }
      );
    }
    debugMyXSpaces("MY_X_SPACES_STAGE_TOKEN_ROW_FOUND");

    let currentAccessToken = (tokenRow as { access_token: string }).access_token;
    const spaceFields = "id,title,state,created_at,scheduled_start";
    debugMyXSpaces("MY_X_SPACES_STAGE_X_API_CALL_START", JSON.stringify({ endpoint: "GET /2/spaces/by/creator_ids", access_token_exists: true, x_user_id_exists: true }));

    let result = await fetchSpacesByCreatorId(xUserId, currentAccessToken, spaceFields);
    const xHttpStatusFirst = result.status;
    let refreshAttempt = 0;
    let refreshSuccess = false;
    let tokenPersistSuccess = false;
    let retryAttempt = 0;
    let xHttpStatusRetry: number | null = null;
    if (!result.ok && result.code === "X_RECONNECT_NEEDED" && hasRefreshToken && supabaseServiceKey && supabaseUrl) {
      refreshAttempt = 1;
      debugMyXSpaces("MY_X_SPACES_STAGE_REFRESH_ATTEMPT", "1");
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
      const refreshed = await refreshXAccessToken(user.id, supabaseService);
      refreshSuccess = !!refreshed?.access_token;
      tokenPersistSuccess = refreshSuccess;
      if (refreshed?.access_token) {
        retryAttempt = 1;
        debugMyXSpaces("MY_X_SPACES_STAGE_RETRY_ATTEMPT", "1");
        currentAccessToken = refreshed.access_token;
        result = await fetchSpacesByCreatorId(xUserId, currentAccessToken, spaceFields);
        xHttpStatusRetry = result.status;
      }
    }
    const finalCode = result.code;
    debugMyXSpaces("PRODUCTION_VERIFY", JSON.stringify({
      token_row_exists: hasTokenRow,
      access_token_exists: hasAccessToken,
      refresh_token_exists: hasRefreshToken,
      x_user_id_exists: !!xUserId,
      x_http_status_first: xHttpStatusFirst,
      refresh_attempt: refreshAttempt,
      refresh_success: refreshSuccess,
      token_persist_success: tokenPersistSuccess,
      retry_attempt: retryAttempt,
      x_http_status_retry: xHttpStatusRetry,
      final_code: finalCode,
    }));
    debugMyXSpaces("MY_X_SPACES_STAGE_X_API_RESPONSE", JSON.stringify({ status: result.status, code: result.code }));
    if (!result.ok && result.bodyText) debugMyXSpaces("MY_X_SPACES_STAGE_X_API_BODY", result.bodyText);
    debugMyXSpaces("MY_X_SPACES_STAGE_FINAL_CODE", finalCode);

    if (!result.ok) {
      if (result.code === "X_RECONNECT_NEEDED") {
        return NextResponse.json(
          { error: "X connection expired or invalid. Reconnect X in Settings or XSpaces.", code: "X_RECONNECT_NEEDED" },
          { status: 403 }
        );
      }
      if (result.code === "X_RATE_LIMITED") {
        return NextResponse.json(
          { error: "X rate limit reached. Try again later.", code: "X_RATE_LIMITED" },
          { status: 429 }
        );
      }
      if (result.code === "X_API_TIMEOUT") {
        return NextResponse.json(
          { error: "X API request timed out. Try again.", code: "X_API_TIMEOUT" },
          { status: 502 }
        );
      }
      if (result.code === "INVALID_X_RESPONSE") {
        return NextResponse.json(
          { error: "Invalid response from X. Try again.", code: "INVALID_X_RESPONSE" },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: "Could not fetch Spaces from X", code: "X_API_FAILED" },
        { status: 502 }
      );
    }
    debugMyXSpaces("MY_X_SPACES_STAGE_PARSE_OK");

    const data = result.data as { data?: unknown };
    const rawSpaces = Array.isArray(data?.data) ? data.data : [];
    const since = new Date(Date.now() - DAYS_AGO * 24 * 60 * 60 * 1000).toISOString();
    const recent = rawSpaces.filter((s: unknown) => {
      if (s == null || typeof s !== "object" || !("created_at" in s)) return false;
      const created = (s as { created_at: unknown }).created_at;
      return typeof created === "string" && created >= since;
    });

    const items: MyXSpaceItem[] = recent
      .filter((s: unknown): s is { id: string; title?: string | null; state?: string | null; created_at?: string | null; scheduled_start?: string | null } => s != null && typeof s === "object" && typeof (s as { id?: string }).id === "string")
      .map((s) => ({
        id: s.id,
        title: typeof s.title === "string" ? s.title : null,
        state: typeof s.state === "string" ? s.state : null,
        started_at: typeof s.created_at === "string" ? s.created_at : null,
        scheduled_start: typeof s.scheduled_start === "string" ? s.scheduled_start : null,
        url: `https://x.com/i/spaces/${s.id}`,
      }));

    debugMyXSpaces("MY_X_SPACES_STAGE_RETURN_SUCCESS", String(items.length));
    return NextResponse.json({ spaces: items });
  } catch (err) {
    const safeDetail = (() => {
      try {
        return sanitizeServerError(err);
      } catch {
        return "Request failed.";
      }
    })();
    debugMyXSpaces("MY_X_SPACES_STAGE_FAIL_INTERNAL", safeDetail);
    return NextResponse.json(
      { error: "Could not load Spaces. Try again.", code: "MY_X_SPACES_INTERNAL_ERROR" },
      { status: 502 }
    );
  }
}
