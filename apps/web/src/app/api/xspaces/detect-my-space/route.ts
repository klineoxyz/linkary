/**
 * POST /api/xspaces/detect-my-space — find X Space(s) matching Linkary space (title + time proximity).
 * Body: { space_id: string, selected_x_space_id?: string }.
 * When multiple candidates pass threshold, returns candidates and require_selection; client calls link-space to link.
 * Rate limited: 10 requests per minute per profile_id (durable via Supabase rate_limits table).
 * Hardened: safe 502 handling, timeout, safe JSON parse, no raw errors to Vercel.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimitXSpacesDetect, xSpacesDetectRateLimitHeaders } from "@/lib/rate-limit";
import { sanitizeServerError, debugDetect } from "@/lib/server-error";
import { fetchSpacesByCreatorId } from "@/lib/x-analytics-server";
import { refreshXAccessToken } from "@/lib/x-token-refresh";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

const WINDOW_MS = 15 * 60 * 1000;
const SCHEDULED_PROXIMITY_MS = 2 * 60 * 60 * 1000;
const MIN_TITLE_SIMILARITY = 0.3;

function tokenize(s: string): Set<string> {
  return new Set(
    (s ?? "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter((t) => t.length > 0)
  );
}

function titleSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0) return tb.size === 0 ? 1 : 0;
  let match = 0;
  for (const t of ta) {
    if (tb.has(t)) match += 1;
  }
  return match / ta.size;
}

function scoreCandidate(
  xSpace: { id?: string; title?: string; created_at?: string; scheduled_start?: string },
  linkaryTitle: string,
  linkaryScheduledAt: string | null
): number {
  const created = xSpace.created_at ? new Date(xSpace.created_at).getTime() : 0;
  if (Number.isNaN(created) || Date.now() - created > WINDOW_MS) return 0;
  const titleSim = titleSimilarity(xSpace.title ?? "", linkaryTitle ?? "");
  if (titleSim < MIN_TITLE_SIMILARITY) return 0;
  if (linkaryScheduledAt && xSpace.scheduled_start) {
    const linkaryTime = new Date(linkaryScheduledAt).getTime();
    const xTime = new Date(xSpace.scheduled_start).getTime();
    if (Number.isNaN(linkaryTime) || Number.isNaN(xTime)) return 0;
    const diff = Math.abs(linkaryTime - xTime);
    if (diff > SCHEDULED_PROXIMITY_MS) return 0;
  }
  let score = 0.4;
  score += 0.3 * titleSim;
  if (linkaryScheduledAt && xSpace.scheduled_start) {
    const linkaryTime = new Date(linkaryScheduledAt).getTime();
    const xTime = new Date(xSpace.scheduled_start).getTime();
    if (Number.isNaN(linkaryTime) || Number.isNaN(xTime)) {
      score += 0.15;
    } else {
      const diff = Math.abs(linkaryTime - xTime);
      score += 0.3 * (1 - diff / SCHEDULED_PROXIMITY_MS);
    }
  } else {
    score += 0.15;
  }
  return score;
}

function emptyRateLimitHeaders(): Record<string, string> {
  return {
    "X-RateLimit-Limit": "10",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": new Date(Date.now() + 60 * 1000).toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_INVALID" }, { status: 401 });
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    debugDetect("DETECT_CONFIG_MISSING", "Supabase env not set");
    return NextResponse.json(
      { error: "Service configuration error.", code: "DETECT_INTERNAL_ERROR" },
      { status: 502 }
    );
  }

  let rateLimitHeaders: Record<string, string> = emptyRateLimitHeaders();

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user?.id) {
      debugDetect("DETECT_STAGE_FAIL_AUTH", sanitizeServerError(userError));
      return NextResponse.json({ error: "Invalid session", code: "AUTH_INVALID" }, { status: 401 });
    }
    debugDetect("DETECT_STAGE_AUTH_OK", user.id);

    const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;
    let rl: Awaited<ReturnType<typeof rateLimitXSpacesDetect>>;
    try {
      rl = await rateLimitXSpacesDetect(user.id, supabaseAdmin);
    } catch (rlErr) {
      debugDetect("RATE_LIMIT_ERROR", sanitizeServerError(rlErr));
      return NextResponse.json(
        { error: "Detection temporarily unavailable.", code: "DETECT_INTERNAL_ERROR" },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    if ("unavailable" in rl && rl.unavailable) {
      debugDetect("DETECT_STAGE_FAIL_RATE_LIMIT_UNAVAILABLE");
      return NextResponse.json(
        { error: "Rate limit service unavailable. Try again later.", code: "RATE_LIMIT_UNAVAILABLE" },
        { status: 503, headers: rateLimitHeaders }
      );
    }

    if (!rl.allowed) {
      rateLimitHeaders = xSpacesDetectRateLimitHeaders(rl);
      return NextResponse.json(
        { error: "Too many detection requests. Try again in a minute.", code: "RATE_LIMITED", resetAt: rl.resetAt },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    rateLimitHeaders = xSpacesDetectRateLimitHeaders(rl);

    let body: { space_id?: string; selected_x_space_id?: string } = {};
    try {
      body = await request.json();
    } catch {
      /* no body */
    }
    const linkarySpaceId = typeof body.space_id === "string" ? body.space_id.trim() : null;
    const selectedXSpaceId = typeof body.selected_x_space_id === "string" ? body.selected_x_space_id.trim() : null;

    const { data: tokenRow, error: tokenError } = await supabase
      .from("x_oauth_tokens")
      .select("access_token, refresh_token, x_user_id")
      .eq("profile_id", user.id)
      .eq("provider", "x")
      .maybeSingle();

    if (tokenError) {
      debugDetect("DETECT_STAGE_FAIL_TOKEN_LOOKUP", tokenError.message);
      return NextResponse.json(
        { error: "Connect X first (Settings or XSpaces) to detect your Space", code: "X_NOT_CONNECTED" },
        { status: 403, headers: rateLimitHeaders }
      );
    }
    const hasTokenRow = !!tokenRow;
    const hasRefreshToken = !!(tokenRow as { refresh_token?: string | null } | null)?.refresh_token;
    if (!tokenRow?.access_token) {
      debugDetect("DETECT_STAGE_FAIL_X_NOT_CONNECTED", "no access_token");
      return NextResponse.json(
        { error: "Connect X first (Settings or XSpaces) to detect your Space", code: "X_NOT_CONNECTED" },
        { status: 403, headers: rateLimitHeaders }
      );
    }
    debugDetect("DETECT_STAGE_TOKEN_ROW", JSON.stringify({ token_row_exists: hasTokenRow, access_token_exists: true, refresh_token_exists: hasRefreshToken, x_user_id_exists: !!(tokenRow as { x_user_id?: string | null }).x_user_id }));

    const xUserId = (tokenRow as { x_user_id: string | null }).x_user_id;
    if (!xUserId || typeof xUserId !== "string") {
      return NextResponse.json(
        { error: "X user id not found. Reconnect X.", code: "X_USER_ID_MISSING" },
        { status: 403, headers: rateLimitHeaders }
      );
    }
    debugDetect("DETECT_STAGE_TOKEN_ROW_FOUND");

    let currentAccessToken = (tokenRow as { access_token: string }).access_token;
    const spaceFields = "created_at,state,title,id,scheduled_start";
    debugDetect("X_API_CALL_START", JSON.stringify({ endpoint: "GET /2/spaces/by/creator_ids", access_token_exists: true, x_user_id_exists: true }));

    let result = await fetchSpacesByCreatorId(xUserId, currentAccessToken, spaceFields);
    const xHttpStatusFirst = result.status;
    let refreshAttempt = 0;
    let refreshSuccess = false;
    let tokenPersistSuccess = false;
    let retryAttempt = 0;
    let xHttpStatusRetry: number | null = null;
    if (!result.ok && result.code === "X_RECONNECT_NEEDED" && hasRefreshToken && supabaseServiceKey && supabaseUrl) {
      refreshAttempt = 1;
      debugDetect("DETECT_STAGE_REFRESH_ATTEMPT", "1");
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const refreshed = await refreshXAccessToken(user.id, supabaseAdmin);
      refreshSuccess = !!refreshed?.access_token;
      tokenPersistSuccess = refreshSuccess;
      if (refreshed?.access_token) {
        retryAttempt = 1;
        debugDetect("DETECT_STAGE_RETRY_ATTEMPT", "1");
        currentAccessToken = refreshed.access_token;
        result = await fetchSpacesByCreatorId(xUserId, currentAccessToken, spaceFields);
        xHttpStatusRetry = result.status;
      }
    }
    const finalCode = result.code;
    debugDetect("PRODUCTION_VERIFY", JSON.stringify({
      token_row_exists: hasTokenRow,
      access_token_exists: true,
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
    debugDetect("X_API_CALL_RESPONSE", JSON.stringify({ status: result.status, code: result.code }));
    if (!result.ok && "bodyText" in result && result.bodyText) debugDetect("X_API_CALL_BODY", result.bodyText);
    debugDetect("DETECT_STAGE_FINAL_CODE", finalCode);

    if (!result.ok) {
      if (result.code === "X_RECONNECT_NEEDED") {
        return NextResponse.json(
          { error: "X connection expired or invalid. Reconnect X in Settings or XSpaces.", code: "X_RECONNECT_NEEDED" },
          { status: 403, headers: rateLimitHeaders }
        );
      }
      if (result.code === "X_RATE_LIMITED") {
        return NextResponse.json(
          { error: "X rate limit reached. Try again in a moment.", code: "X_RATE_LIMITED" },
          { status: 429, headers: rateLimitHeaders }
        );
      }
      if (result.code === "X_API_TIMEOUT") {
        return NextResponse.json(
          { error: "X API request timed out. Try again.", code: "X_API_TIMEOUT" },
          { status: 502, headers: rateLimitHeaders }
        );
      }
      if (result.code === "INVALID_X_RESPONSE") {
        return NextResponse.json(
          { error: "Invalid response from X. Try again.", code: "INVALID_X_RESPONSE" },
          { status: 502, headers: rateLimitHeaders }
        );
      }
      return NextResponse.json(
        { error: "Could not fetch Spaces from X", code: "X_API_FAILED" },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    const data = result.data as { data?: unknown };
    debugDetect("DETECT_STAGE_X_API_RESPONSE", Array.isArray(data?.data) ? `items=${(data.data as unknown[]).length}` : "no array");

    const spaces = Array.isArray(data?.data) ? data.data : [];
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const recent = spaces.filter((s: unknown) => {
      if (s == null || typeof s !== "object" || !("created_at" in s)) return false;
      const created = (s as { created_at: unknown }).created_at;
      return typeof created === "string" && created >= since;
    });

    let linkaryTitle = "";
    let linkaryScheduledAt: string | null = null;
    if (linkarySpaceId) {
      const { data: space } = await supabase
        .from("spaces")
        .select("id, host_profile_id, title, scheduled_at")
        .eq("id", linkarySpaceId)
        .maybeSingle();
      const sp = space as { id: string; host_profile_id: string; title: string; scheduled_at: string | null } | null;
      if (sp && sp.host_profile_id === user.id) {
        linkaryTitle = sp.title ?? "";
        linkaryScheduledAt = sp.scheduled_at ?? null;
      }
    }

    if (selectedXSpaceId && linkarySpaceId) {
      const valid = recent.some((s: { id: string }) => s.id === selectedXSpaceId);
      if (valid) {
        const { data: space } = await supabase
          .from("spaces")
          .select("id, host_profile_id, x_space_id, x_space_url")
          .eq("id", linkarySpaceId)
          .maybeSingle();
        const sp = space as { id: string; host_profile_id: string; x_space_id: string | null; x_space_url: string | null } | null;
        if (sp && sp.host_profile_id === user.id) {
          const alreadyLinked = !!(sp.x_space_id ?? sp.x_space_url);
          if (alreadyLinked) {
            return NextResponse.json(
              {
                error: "This space is already linked to an X Space. Use Replace to change it.",
                code: "ALREADY_LINKED",
                x_space_id: sp.x_space_id ?? null,
                x_space_url: sp.x_space_url ?? null,
              },
              { status: 409, headers: rateLimitHeaders }
            );
          }
          const xSpaceUrl = `https://x.com/i/spaces/${selectedXSpaceId}`;
          await supabase
            .from("spaces")
            .update({
              x_space_id: selectedXSpaceId,
              x_space_url: xSpaceUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", linkarySpaceId);
          return NextResponse.json(
            {
              found: true,
              linked: true,
              x_space_id: selectedXSpaceId,
              x_space_url: xSpaceUrl,
              space_id: linkarySpaceId,
            },
            { headers: rateLimitHeaders }
          );
        }
      }
    }

    type XSpaceItem = { id?: string; title?: string; created_at?: string; scheduled_start?: string; state?: string };
    const scored = recent
      .filter((s: unknown): s is XSpaceItem => s != null && typeof s === "object" && typeof (s as XSpaceItem).id === "string")
      .map((s: XSpaceItem) => ({
        space: s,
        score: scoreCandidate(s, linkaryTitle, linkaryScheduledAt),
      }))
      .filter((x: { score: number }) => x.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    // Only send candidates with a real string id to the UI (guard against malformed X API data).
    type ScoredWithId = { space: XSpaceItem & { id: string }; score: number };
    const safeScored = scored.filter(
      (x): x is ScoredWithId => typeof x.space.id === "string" && x.space.id.length > 0
    );
    const candidates = safeScored.map((x: ScoredWithId) => ({
      id: x.space.id,
      title: x.space.title ?? null,
      state: x.space.state ?? null,
      created_at: x.space.created_at ?? null,
      scheduled_start: x.space.scheduled_start ?? null,
      score: Math.round(x.score * 100) / 100,
    }));
    debugDetect("DETECT_STAGE_CANDIDATES_BUILT", String(candidates.length));

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          found: false,
          message: "No matching Space in the last 15 minutes. Check title and time, or paste the link below.",
        },
        { headers: rateLimitHeaders }
      );
    }

    if (candidates.length === 1 && candidates[0].score >= 0.5) {
      const picked = candidates[0];
      const xSpaceUrl = `https://x.com/i/spaces/${picked.id}`;
      if (linkarySpaceId) {
        const { data: space } = await supabase
          .from("spaces")
          .select("id, host_profile_id, x_space_id, x_space_url")
          .eq("id", linkarySpaceId)
          .maybeSingle();
        const sp = space as { id: string; host_profile_id: string; x_space_id: string | null; x_space_url: string | null } | null;
        if (sp && sp.host_profile_id === user.id) {
          const alreadyLinked = !!(sp.x_space_id ?? sp.x_space_url);
          if (alreadyLinked) {
            return NextResponse.json(
              {
                error: "This space is already linked to an X Space. Use Replace to change it.",
                code: "ALREADY_LINKED",
                x_space_id: sp.x_space_id ?? null,
                x_space_url: sp.x_space_url ?? null,
              },
              { status: 409, headers: rateLimitHeaders }
            );
          }
          await supabase
            .from("spaces")
            .update({
              x_space_id: picked.id,
              x_space_url: xSpaceUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", linkarySpaceId);
        }
      }
      return NextResponse.json(
        {
          found: true,
          linked: true,
          x_space_id: picked.id,
          x_space_url: xSpaceUrl,
          title: picked.title,
          state: picked.state,
          space_id: linkarySpaceId ?? undefined,
        },
        { headers: rateLimitHeaders }
      );
    }

    return NextResponse.json(
      {
        found: true,
        require_selection: true,
        candidates,
        message: "Multiple Spaces match. Choose the correct one below.",
      },
      { headers: rateLimitHeaders }
    );
  } catch (err) {
    let safeDetail: string;
    try {
      safeDetail = sanitizeServerError(err);
    } catch {
      safeDetail = "Detection failed.";
    }
    debugDetect("DETECT_INTERNAL_ERROR", safeDetail);
    return NextResponse.json(
      { error: "Detection failed. Try again.", code: "DETECT_INTERNAL_ERROR" },
      { status: 502, headers: rateLimitHeaders }
    );
  }
}
