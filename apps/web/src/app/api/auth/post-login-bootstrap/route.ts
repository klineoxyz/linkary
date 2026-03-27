import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { claimSafeSlug } from "@/lib/slug/safeSlug";

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
 * This covers identity/analytics (social_accounts). XSpaces import/detect use x_oauth_tokens and require the separate
 * "Connect X" flow on /xspaces — do not assume login populates x_oauth_tokens.
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
    await supabase.from("product_events").insert({
      source_app: "web",
      event_name: "auth_signed_in",
      user_id: user.id,
      properties: { via: "post_login_bootstrap", has_x_identity: false },
    });
    const { data: statusRow } = await supabase
      .from("profiles")
      .select("account_type, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();
    const at = (statusRow as { account_type?: string | null } | null)?.account_type;
    const oca = (statusRow as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at;
    const needsOnboarding = !at || (at !== "individual" && at !== "company") || !oca;
    return NextResponse.json({ ok: true, userId: user.id, username: null, needsOnboarding });
  }

  const raw = (xIdentity.identity_data ?? xIdentity) as Record<string, unknown>;
  const providerUserId = firstStr(raw, "id", "sub") ?? (raw.id as string) ?? (raw.sub as string) ?? "";
  const username = firstStr(raw, "user_name", "preferred_username", "username", "screen_name", "nickname");
  const handle = username ? String(username).replace(/^@/, "").trim() : null;

  if (!providerUserId) {
    const { data: statusRow } = await supabase
      .from("profiles")
      .select("account_type, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();
    const at = (statusRow as { account_type?: string | null } | null)?.account_type;
    const oca = (statusRow as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at;
    const needsOnboarding = !at || (at !== "individual" && at !== "company") || !oca;
    return NextResponse.json({ ok: true, userId: user.id, username: null, needsOnboarding });
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

  // Claim username from X handle (safe slug: reserved -> fallback with suffix; retry on TAKEN).
  const normalizedHandle = handle?.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "-") ?? null;
  if (normalizedHandle && normalizedHandle.length >= 2) {
    const { error: _claimErr } = await claimSafeSlug(normalizedHandle, user.id, async (slug) => {
      const { error } = await supabase.rpc("claim_username_for_profile", { desired_username: slug });
      return { error: error?.message ?? null };
    });
    // Don't fail login if claim fails (e.g. TAKEN); profile and handle are already set.
  }

  const { data: statusRow } = await supabase
    .from("profiles")
    .select("account_type, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  const at = (statusRow as { account_type?: string | null } | null)?.account_type;
  const oca = (statusRow as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at;
  const needsOnboarding =
    !at || (at !== "individual" && at !== "company") || !oca;

  await supabase.from("product_events").insert([
    {
      source_app: "web",
      event_name: "auth_signed_in",
      user_id: user.id,
      properties: { via: "post_login_bootstrap", has_x_identity: true },
    },
    {
      source_app: "web",
      event_name: "x_connect_completed",
      user_id: user.id,
      properties: { via: "post_login_bootstrap", provider: "x" },
    },
  ]);

  return NextResponse.json({ ok: true, userId: user.id, username: handle, needsOnboarding });
}
