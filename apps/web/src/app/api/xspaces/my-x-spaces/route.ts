/**
 * GET /api/xspaces/my-x-spaces — list recent X Spaces for the connected user (X API v2 by creator).
 * Auth required; token from x_oauth_tokens. Returns normalized list (id, title, state, started_at, scheduled_start, url).
 * No tokens in response.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const X_API_BASE = "https://api.twitter.com/2";
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

  const { data: tokenRow, error: tokenError } = await supabase
    .from("x_oauth_tokens")
    .select("access_token, x_user_id")
    .eq("profile_id", user.id)
    .eq("provider", "x")
    .maybeSingle();

  if (tokenError || !tokenRow?.access_token || !(tokenRow as { x_user_id?: string | null }).x_user_id) {
    return NextResponse.json({ error: "Connect X first to see your Spaces", code: "X_NOT_CONNECTED" }, { status: 403 });
  }

  const xUserId = (tokenRow as { x_user_id: string }).x_user_id;
  const accessToken = (tokenRow as { access_token: string }).access_token;
  const spaceFields = "id,title,state,created_at,scheduled_start";
  const url = `${X_API_BASE}/spaces/by/creator_ids?user_ids=${encodeURIComponent(xUserId)}&space.fields=${encodeURIComponent(spaceFields)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Could not fetch Spaces from X", code: "X_API_ERROR" }, { status: 502 });
  }

  const data = (await res.json()) as {
    data?: Array<{ id: string; title?: string | null; state?: string | null; created_at?: string | null; scheduled_start?: string | null }>;
  };
  const spaces = data?.data ?? [];
  const since = new Date(Date.now() - DAYS_AGO * 24 * 60 * 60 * 1000).toISOString();
  const recent = spaces.filter((s) => (s.created_at ?? "") >= since);

  const items: MyXSpaceItem[] = recent.map((s) => ({
    id: s.id,
    title: typeof s.title === "string" ? s.title : null,
    state: typeof s.state === "string" ? s.state : null,
    started_at: typeof s.created_at === "string" ? s.created_at : null,
    scheduled_start: typeof s.scheduled_start === "string" ? s.scheduled_start : null,
    url: `https://x.com/i/spaces/${s.id}`,
  }));

  return NextResponse.json({ spaces: items });
}
