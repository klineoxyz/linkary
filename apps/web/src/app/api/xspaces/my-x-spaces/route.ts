/**
 * GET /api/xspaces/my-x-spaces — list recent X Spaces for the connected user (X API v2 by creator).
 * Auth required; token from x_oauth_tokens. Returns normalized list (id, title, state, started_at, scheduled_start, url).
 * No tokens in response. Hardened: try/catch, timeout, deterministic codes, env-gated debug (DEBUG_MY_X_SPACES=1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sanitizeServerError, sanitizeResponseBody, debugMyXSpaces } from "@/lib/server-error";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const X_API_BASE = "https://api.twitter.com/2";
const DAYS_AGO = 30;
const X_API_TIMEOUT_MS = 8000;

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
      .select("access_token, x_user_id")
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
    if (!tokenRow) {
      debugMyXSpaces("MY_X_SPACES_STAGE_FAIL_X_NOT_CONNECTED", "no token row");
      return NextResponse.json(
        { error: "Connect X first to see your Spaces", code: "X_NOT_CONNECTED" },
        { status: 403 }
      );
    }
    const hasAccessToken = !!(tokenRow as { access_token?: string }).access_token;
    const xUserId = (tokenRow as { x_user_id?: string | null }).x_user_id;
    if (!hasAccessToken) {
      debugMyXSpaces("MY_X_SPACES_STAGE_FAIL_X_ACCESS_TOKEN_MISSING");
      return NextResponse.json(
        { error: "X connection incomplete. Reconnect X in Settings or XSpaces.", code: "X_ACCESS_TOKEN_MISSING" },
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

    const accessToken = (tokenRow as { access_token: string }).access_token;
    const spaceFields = "id,title,state,created_at,scheduled_start";
    const url = `${X_API_BASE}/spaces/by/creator_ids?user_ids=${encodeURIComponent(xUserId)}&space.fields=${encodeURIComponent(spaceFields)}`;

    const debugMyXSpacesEnv = process.env.DEBUG_MY_X_SPACES === "1" || process.env.DEBUG_MY_X_SPACES === "true";
    if (debugMyXSpacesEnv) {
      const safeEndpoint = `${X_API_BASE}/spaces/by/creator_ids?user_ids=REDACTED&space.fields=${encodeURIComponent(spaceFields)}`;
      debugMyXSpaces("MY_X_SPACES_STAGE_X_API_CALL_START", JSON.stringify({ endpoint: safeEndpoint, access_token_exists: true, x_user_id_exists: true }));
    }

    let res: Response;
    const t0 = Date.now();
    try {
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), X_API_TIMEOUT_MS);
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: ac.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      const isTimeout = (fetchErr as { name?: string }).name === "AbortError";
      debugMyXSpaces(isTimeout ? "MY_X_SPACES_STAGE_FAIL_X_API_TIMEOUT" : "MY_X_SPACES_STAGE_FAIL_X_API", sanitizeServerError(fetchErr));
      return NextResponse.json(
        {
          error: isTimeout ? "X API request timed out. Try again." : "Could not fetch Spaces from X.",
          code: isTimeout ? "X_API_TIMEOUT" : "X_API_FAILED",
        },
        { status: 502 }
      );
    }

    const ms = Date.now() - t0;
    if (debugMyXSpacesEnv) {
      debugMyXSpaces("MY_X_SPACES_STAGE_X_API_RESPONSE", JSON.stringify({ status: res.status, ms }));
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (debugMyXSpacesEnv && body) debugMyXSpaces("MY_X_SPACES_STAGE_X_API_BODY", sanitizeResponseBody(body));
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: "X connection expired or invalid. Reconnect X in Settings or XSpaces.", code: "X_RECONNECT_NEEDED" },
          { status: 403 }
        );
      }
      if (res.status === 429) {
        return NextResponse.json(
          { error: "X rate limit reached. Try again later.", code: "X_RATE_LIMITED" },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Could not fetch Spaces from X", code: "X_API_FAILED" },
        { status: 502 }
      );
    }

    let data: { data?: unknown };
    try {
      data = (await res.json()) as { data?: unknown };
    } catch {
      debugMyXSpaces("MY_X_SPACES_STAGE_FAIL_INVALID_RESPONSE", "X API response was not JSON");
      return NextResponse.json(
        { error: "Invalid response from X. Try again.", code: "INVALID_X_RESPONSE" },
        { status: 502 }
      );
    }
    debugMyXSpaces("MY_X_SPACES_STAGE_PARSE_OK");

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
