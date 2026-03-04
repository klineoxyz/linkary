/**
 * POST /api/xspaces/detect-my-space — find X Space(s) matching Linkary space (title + time proximity).
 * Body: { space_id: string, selected_x_space_id?: string }.
 * When multiple candidates pass threshold, returns candidates and require_selection; client calls again with selected_x_space_id to link.
 * Rate limited per user (in-memory).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const X_API_BASE = "https://api.twitter.com/2";

const WINDOW_MS = 15 * 60 * 1000;
const SCHEDULED_PROXIMITY_MS = 2 * 60 * 60 * 1000;
const MIN_TITLE_SIMILARITY = 0.3;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

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
  xSpace: { id: string; title?: string; created_at?: string; scheduled_start?: string },
  linkaryTitle: string,
  linkaryScheduledAt: string | null
): number {
  const created = xSpace.created_at ? new Date(xSpace.created_at).getTime() : 0;
  if (Date.now() - created > WINDOW_MS) return 0;
  let score = 0.4;
  const titleSim = titleSimilarity(xSpace.title ?? "", linkaryTitle ?? "");
  if (titleSim < MIN_TITLE_SIMILARITY) return 0;
  score += 0.3 * titleSim;
  if (linkaryScheduledAt && xSpace.scheduled_start) {
    const linkaryTime = new Date(linkaryScheduledAt).getTime();
    const xTime = new Date(xSpace.scheduled_start).getTime();
    const diff = Math.abs(linkaryTime - xTime);
    if (diff <= SCHEDULED_PROXIMITY_MS) score += 0.3 * (1 - diff / SCHEDULED_PROXIMITY_MS);
  } else {
    score += 0.15;
  }
  return score;
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(userId);
  if (!entry) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
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

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many detection requests. Try again in a minute.", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

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
    .select("access_token, x_user_id")
    .eq("profile_id", user.id)
    .eq("provider", "x")
    .maybeSingle();

  if (tokenError || !tokenRow?.access_token) {
    return NextResponse.json(
      { error: "Connect X first (Settings or XSpaces) to detect your Space", code: "X_NOT_CONNECTED" },
      { status: 403 }
    );
  }

  const xUserId = (tokenRow as { x_user_id: string | null }).x_user_id;
  if (!xUserId) {
    return NextResponse.json(
      { error: "X user id not found. Reconnect X.", code: "X_NOT_CONNECTED" },
      { status: 403 }
    );
  }

  const spaceFields = "created_at,state,title,id,scheduled_start";
  const url = `${X_API_BASE}/spaces/by/creator_ids?user_ids=${encodeURIComponent(xUserId)}&space.fields=${encodeURIComponent(spaceFields)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${(tokenRow as { access_token: string }).access_token}` },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Could not fetch Spaces from X", code: "X_API_ERROR" },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    data?: Array<{ id: string; state?: string; title?: string; created_at?: string; scheduled_start?: string }>;
  };
  const spaces = data?.data ?? [];
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const recent = spaces.filter((s) => s.created_at && s.created_at >= since);

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
    const valid = recent.some((s) => s.id === selectedXSpaceId);
    if (valid) {
      const xSpaceUrl = `https://x.com/i/spaces/${selectedXSpaceId}`;
      const { data: space } = await supabase
        .from("spaces")
        .select("id, host_profile_id")
        .eq("id", linkarySpaceId)
        .maybeSingle();
      const sp = space as { id: string; host_profile_id: string } | null;
      if (sp && sp.host_profile_id === user.id) {
        await supabase
          .from("spaces")
          .update({
            x_space_id: selectedXSpaceId,
            x_space_url: xSpaceUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkarySpaceId);
        return NextResponse.json({
          found: true,
          linked: true,
          x_space_id: selectedXSpaceId,
          x_space_url: xSpaceUrl,
          space_id: linkarySpaceId,
        });
      }
    }
  }

  const scored = recent
    .map((s) => ({ space: s, score: scoreCandidate(s, linkaryTitle, linkaryScheduledAt) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const candidates = scored.map((x) => ({
    id: x.space.id,
    title: x.space.title ?? null,
    state: x.space.state ?? null,
    created_at: x.space.created_at ?? null,
    scheduled_start: x.space.scheduled_start ?? null,
    score: Math.round(x.score * 100) / 100,
  }));

  if (candidates.length === 0) {
    return NextResponse.json({
      found: false,
      message: "No matching Space in the last 15 minutes. Check title and time, or paste the link below.",
    });
  }

  if (candidates.length === 1 && candidates[0].score >= 0.5) {
    const picked = candidates[0];
    const xSpaceUrl = `https://x.com/i/spaces/${picked.id}`;
    if (linkarySpaceId) {
      const { data: space } = await supabase
        .from("spaces")
        .select("id, host_profile_id")
        .eq("id", linkarySpaceId)
        .maybeSingle();
      const sp = space as { id: string; host_profile_id: string } | null;
      if (sp && sp.host_profile_id === user.id) {
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
    return NextResponse.json({
      found: true,
      linked: true,
      x_space_id: picked.id,
      x_space_url: xSpaceUrl,
      title: picked.title,
      state: picked.state,
      space_id: linkarySpaceId ?? undefined,
    });
  }

  return NextResponse.json({
    found: true,
    require_selection: true,
    candidates,
    message: "Multiple Spaces match. Choose the correct one below.",
  });
}
