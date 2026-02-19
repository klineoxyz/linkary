import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const twitterApiKey = process.env.TWITTERAPI_API_KEY;

/** GET or POST: sync profile from X via twitterapi.io (handle, display name, bio, avatar, followers, engagement). */
export async function GET(request: NextRequest) {
  return handleSync(request);
}
export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized or missing config" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, twitter_username")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const userName = (profile.twitter_username || profile.username || "").trim().replace(/^@/, "");
  if (!userName) {
    return NextResponse.json({ error: "No X username to sync. Connect X in Settings → Integrations first." }, { status: 400 });
  }

  if (!twitterApiKey) {
    return NextResponse.json(
      { error: "X analytics not configured. Set TWITTERAPI_API_KEY." },
      { status: 503 }
    );
  }

  const apiUrl = `https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(userName)}`;
  const res = await fetch(apiUrl, {
    headers: { "X-API-Key": twitterApiKey },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: "X API error", detail: err },
      { status: res.status === 400 ? 400 : 502 }
    );
  }

  const json = await res.json();
  const data = json?.data;
  if (!data || json?.status === "error") {
    return NextResponse.json(
      { error: json?.msg || "X user not found" },
      { status: 404 }
    );
  }

  const followers = typeof data.followers === "number" ? data.followers : 0;
  const following = typeof data.following === "number" ? data.following : 0;
  const statusesCount = typeof data.statusesCount === "number" ? data.statusesCount : 0;
  const favouritesCount = typeof data.favouritesCount === "number" ? data.favouritesCount : 0;
  const avgEngagement =
    followers > 0
      ? Math.min(100, Math.round(((statusesCount + favouritesCount) / followers) * 1000) / 10)
      : 0;

  const updates: Record<string, unknown> = {
    username: (data.userName || userName).toLowerCase().replace(/\s+/g, "-"),
    display_name: (data.name || "").trim() || null,
    bio: (data.description || "").trim() || null,
    avatar_url: (data.profilePicture || "").trim() || null,
    twitter_username: (data.userName || userName).replace(/\s+/g, "-"),
    followers_total: followers,
    avg_engagement_rate: avgEngagement,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      username: updates.username,
      display_name: updates.display_name,
      bio: updates.bio,
      avatar_url: updates.avatar_url,
      twitter_username: updates.twitter_username,
      followers_total: updates.followers_total,
      avg_engagement_rate: updates.avg_engagement_rate,
    },
  });
}
