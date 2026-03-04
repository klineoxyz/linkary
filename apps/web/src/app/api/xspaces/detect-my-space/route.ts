/**
 * POST /api/xspaces/detect-my-space — poll X API for a Space created by this host in the last 15 minutes.
 * Body: { space_id?: string } — optional Linkary space id to update with x_space_id/x_space_url when found.
 * Requires x_oauth_tokens (Connect X) to be set for the current user.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const X_API_BASE = "https://api.twitter.com/2";

const WINDOW_MS = 15 * 60 * 1000;

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

  const url = `${X_API_BASE}/spaces/by/creator_ids?user_ids=${encodeURIComponent(xUserId)}&space.fields=created_at,state,title,id`;
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
    data?: Array<{ id: string; state?: string; title?: string; created_at?: string }>;
  };
  const spaces = data?.data ?? [];
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const recent = spaces
    .filter((s) => s.created_at && s.created_at >= since)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const picked = recent[0];
  if (!picked) {
    return NextResponse.json({
      found: false,
      message: "No Space created in the last 15 minutes. Create one on X and try again, or paste the link below.",
    });
  }

  const xSpaceId = picked.id;
  const xSpaceUrl = `https://x.com/i/spaces/${xSpaceId}`;

  let body: { space_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* no body */
  }
  const linkarySpaceId = typeof body.space_id === "string" ? body.space_id.trim() : null;

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
          x_space_id: xSpaceId,
          x_space_url: xSpaceUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", linkarySpaceId);
    }
  }

  return NextResponse.json({
    found: true,
    x_space_id: xSpaceId,
    x_space_url: xSpaceUrl,
    title: picked.title ?? null,
    state: picked.state ?? null,
    space_id: linkarySpaceId ?? undefined,
  });
}
