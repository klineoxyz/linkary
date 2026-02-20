import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTwitterIdentity } from "@/lib/auth-x-identity";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST: Sync current session's X identity to profile and social_accounts.
 * Call when user has signed in with X but profile/social_accounts are not yet updated
 * (e.g. they landed on Integrations without going through the OAuth callback).
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

  const identity = extractTwitterIdentity(user as Parameters<typeof extractTwitterIdentity>[0]);
  if (!identity) {
    return NextResponse.json({ ok: true, synced: false });
  }

  const handle = identity.user_name ?? identity.preferred_username ?? identity.username ?? null;
  const normalizedHandle = handle?.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "-") ?? null;
  const twitterUserId = identity.id ?? identity.sub ?? null;

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!existingProfile) {
    await supabase.from("profiles").insert({
      id: user.id,
      username: null,
      display_name: null,
      bio: null,
      avatar_url: identity.avatar_url ?? null,
      website: null,
      twitter_username: normalizedHandle,
      twitter_user_id: twitterUserId,
      twitter_connected_at: new Date().toISOString(),
      onboarding_completed_at: null,
      published: false,
      location: null,
      intents: [],
      followers_total: 0,
      avg_engagement_rate: 0,
    });
  } else {
    const updates: Record<string, unknown> = {
      twitter_user_id: twitterUserId,
      twitter_connected_at: new Date().toISOString(),
    };
    if (identity.avatar_url) updates.avatar_url = identity.avatar_url;
    if (normalizedHandle) updates.twitter_username = normalizedHandle;
    await supabase.from("profiles").update(updates).eq("id", user.id);
  }

  if (normalizedHandle) {
    await supabase.rpc("claim_username_for_profile", { desired_username: normalizedHandle });
  }

  const now = new Date().toISOString();
  await supabase.from("social_accounts").upsert(
    {
      user_id: user.id,
      provider: "x",
      provider_user_id: twitterUserId,
      username: normalizedHandle,
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      profile_json: { name: identity.name, avatar_url: identity.avatar_url },
      updated_at: now,
      revoked_at: null,
      status: "connected",
    },
    { onConflict: "user_id,provider" }
  );

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (serviceKey && normalizedHandle) {
    const service = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await service.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profile?.id) {
      const { count } = await service.from("x_daily_snapshots").select("id", { count: "exact", head: true }).eq("owner_type", "profile").eq("owner_id", profile.id);
      if ((count ?? 0) < 7) {
        await service.from("analytics_jobs").insert({
          job_type: "x_backfill_90d",
          owner_type: "profile",
          owner_id: profile.id,
          run_after: now,
          status: "queued",
          payload: { username: normalizedHandle, user_id: user.id },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, synced: true });
}
