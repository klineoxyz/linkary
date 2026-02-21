import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function firstStr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function isXProvider(p: unknown): boolean {
  const s = (p as string)?.toLowerCase();
  return s === "twitter" || s === "x";
}

/**
 * POST /api/auth/post-login-bootstrap
 * Run once after X OAuth login: ensure profile row, upsert social_accounts from X identity, update profile mirror.
 * So X connection is automatic on login; no separate "Connect X" needed for MVP.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!existingProfile) {
    await supabase.from("profiles").insert({
      id: user.id,
      username: null,
      display_name: null,
      bio: null,
      avatar_url: null,
      website: null,
      twitter_username: null,
      onboarding_completed_at: null,
      published: false,
      location: null,
      intents: [],
      followers_total: 0,
      avg_engagement_rate: 0,
    });
  }

  const identities = (user as unknown as { identities?: Array<Record<string, unknown>> }).identities ?? [];
  const xIdentity = identities.find((i) => isXProvider(i.provider)) as Record<string, unknown> | undefined;

  if (!xIdentity) {
    return NextResponse.json({ ok: true, userId: user.id, username: null });
  }

  const raw = (xIdentity.identity_data ?? xIdentity) as Record<string, unknown>;
  const providerUserId = firstStr(raw, "id", "sub") ?? (raw.id as string) ?? (raw.sub as string) ?? "";
  const username = firstStr(raw, "user_name", "preferred_username", "username", "screen_name", "nickname");
  const handle = username ? String(username).replace(/^@/, "").trim() : null;

  if (!providerUserId) {
    return NextResponse.json({ ok: true, userId: user.id, username: null });
  }

  const providerUserIdTrim = String(providerUserId).trim();
  const now = new Date().toISOString();

  const { data: existingRow } = await supabase
    .from("social_accounts")
    .select("connected_at")
    .eq("user_id", user.id)
    .in("provider", ["x", "twitter"])
    .maybeSingle();

  const connectedAt = (existingRow as { connected_at?: string } | null)?.connected_at ?? now;

  await supabase.from("social_accounts").upsert(
    {
      user_id: user.id,
      provider: "twitter",
      provider_user_id: providerUserIdTrim,
      username: handle,
      status: "connected",
      revoked_at: null,
      connected_at: connectedAt,
      updated_at: now,
      profile_json: raw,
    },
    { onConflict: "user_id,provider" }
  );

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("twitter_username, twitter_user_id")
    .eq("id", user.id)
    .maybeSingle();

  const currentHandle = (profileRow as { twitter_username?: string | null })?.twitter_username?.trim();
  const updates: Record<string, unknown> = {
    twitter_user_id: providerUserIdTrim,
    twitter_connected_at: now,
  };
  if (handle) {
    if (currentHandle && currentHandle !== handle) {
      updates.twitter_username_candidate = handle;
    } else if (!currentHandle) {
      updates.twitter_username = handle;
    }
  }
  await supabase.from("profiles").update(updates).eq("id", user.id);

  return NextResponse.json({ ok: true, userId: user.id, username: handle });
}
