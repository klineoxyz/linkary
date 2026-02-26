/**
 * Profile helpers: current user profile, ensure row, update.
 * Do not overwrite non-empty profiles.twitter_username in updates.
 */
import { supabase } from "./supabase";

export type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  twitter_username: string | null;
  twitter_user_id?: string | null;
  twitter_connected_at?: string | null;
  twitter_username_candidate?: string | null;
  /** Canonical DB truth: true when twitter_username or twitter_user_id is set. UI must use this, not identities. */
  x_connected?: boolean;
  onboarding_completed_at: string | null;
  /** Set during onboarding: individual or company. Company can create orgs. */
  account_type?: 'individual' | 'company' | null;
  published: boolean;
  /** Controls whether analytics (followers_total, avg_engagement_rate, xscore) are exposed on public views. */
  analytics_visibility?: 'public' | 'private';
  location: string | null;
  intents: string[];
  followers_total: number;
  avg_engagement_rate: number;
  /** XScore 0–1000 (e.g. from Wallchain extension). */
  xscore?: number | null;
  created_at: string;
  updated_at: string;
  /** X analytics ingestion (cron / manual sync) */
  x_last_profile_sync_at?: string | null;
  x_last_tweets_sync_at?: string | null;
  x_sync_status?: string | null;
  x_sync_error?: string | null;
  /** CDP embedded wallet */
  cdp_wallet_address?: string | null;
  cdp_wallet_chain?: string | null;
  cdp_wallet_type?: string | null;
  cdp_wallet_created_at?: string | null;
  cdp_mfa_enabled?: boolean;
  /** When true, attach analytics snapshot to new job applications */
  share_analytics_on_apply?: boolean;
  /** When true, allow sharing CV with org when applying */
  share_cv_on_apply?: boolean;
  /** Current CV document id (profile_documents) */
  cv_document_id?: string | null;
};

/** Identity shape from Supabase auth (user.identities or provider raw_user_meta) */
export type TwitterIdentity = {
  provider: string;
  id?: string;
  sub?: string;
  user_name?: string;
  preferred_username?: string;
  username?: string;
  /** X display name (e.g. "Alice") */
  name?: string;
  avatar_url?: string;
  picture?: string;
  profile_image_url?: string;
  /** X profile description (bio) when returned by OAuth */
  description?: string;
};

const PROFILES = "profiles";

/**
 * Canonical mapping: auth user → profile id for ownership checks.
 * In this repo, profiles.id = auth.uid() (profile row PK is the user id).
 * Use this helper everywhere we need "the current user's profile id" so that
 * if a separate auth→profile mapping is introduced later, one place is updated.
 * @see RLS policies use profile_id = auth.uid() / owner_profile_id = auth.uid()
 */
export function getProfileIdForAuthUser(authUserId: string): string {
  return authUserId;
}

/** Get current user's profile by auth.uid(). */
export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from(PROFILES)
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  const p = data as Record<string, unknown>;
  return {
    ...p,
    intents: Array.isArray(p.intents) ? p.intents : (typeof p.intents === "string" ? JSON.parse(p.intents || "[]") : []),
    published: !!p.published,
    analytics_visibility: (p.analytics_visibility === 'private' ? 'private' : 'public') as 'public' | 'private',
    followers_total: Number(p.followers_total ?? 0),
    avg_engagement_rate: Number(p.avg_engagement_rate ?? 0),
  } as Profile;
}

/** Insert profiles row if missing (id = userId). Used after signup. */
export async function ensureProfileForSession(userId: string): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from(PROFILES)
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return { error: null };

  const { error } = await supabase.from(PROFILES).insert({
    id: userId,
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
  return { error: error?.message ?? null };
}

/** Update current user's profile. Does NOT overwrite non-empty twitter_username. xscore is write-only via Wallchain/cron/service-role; never accepted here. */
export async function updateMyProfile(
  userId: string,
  payload: {
    email?: string | null;
    username?: string | null;
    display_name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    website?: string | null;
    twitter_username?: string | null;
    location?: string | null;
    intents?: string[];
    published?: boolean;
    analytics_visibility?: 'public' | 'private';
    onboarding_completed_at?: string | null;
    followers_total?: number;
    avg_engagement_rate?: number;
    share_analytics_on_apply?: boolean;
    share_cv_on_apply?: boolean;
    profile_type?: 'individual' | 'project' | 'company' | null;
    hero_image_url?: string | null;
    hero_video_url?: string | null;
    hero_title?: string | null;
  }
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = { ...payload };
  delete updates.xscore;
  if (updates.twitter_username !== undefined) {
    const { data: row } = await supabase.from(PROFILES).select("twitter_username").eq("id", userId).maybeSingle();
    const current = (row?.twitter_username ?? "").toString().trim();
    if (current !== "") {
      const incoming = (updates.twitter_username ?? "").toString().trim().replace(/^@/, "");
      const currentNorm = current.replace(/^@/, "").toLowerCase();
      const incomingNorm = incoming.toLowerCase();
      if (incomingNorm !== currentNorm) {
        delete updates.twitter_username;
      }
    }
  }
  if (Array.isArray(updates.intents)) {
    updates.intents = updates.intents;
  }
  const { error } = await supabase.from(PROFILES).update(updates).eq("id", userId);
  return { error: error?.message ?? null };
}

/**
 * Claim username via RPC (proof-based; unverified placeholders are reassigned).
 * Returns error code USERNAME_TAKEN_VERIFIED or message.
 */
export async function claimUsernameForProfile(desiredUsername: string): Promise<{ error: string | null }> {
  const normalized = desiredUsername.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "-");
  if (!normalized || normalized.length < 2) return { error: "Invalid username" };
  const { error } = await supabase.rpc("claim_username_for_profile", {
    desired_username: normalized,
  });
  if (!error) return { error: null };
  const msg = error.message ?? "";
  if (msg.includes("USERNAME_TAKEN_VERIFIED")) return { error: "USERNAME_TAKEN_VERIFIED" };
  return { error: msg || "Claim failed" };
}

/**
 * Save X (Twitter) identity from OAuth into profiles.
 * Does NOT set profiles.username directly; calls claim_username_for_profile RPC.
 */
export async function saveTwitterIdentityFromOAuth(
  userId: string,
  identity: TwitterIdentity
): Promise<{ error: string | null }> {
  const twitterUserId = identity.id ?? identity.sub ?? null;
  const handle =
    identity.user_name ??
    identity.preferred_username ??
    identity.username ??
    null;
  const avatar =
    identity.avatar_url ??
    identity.picture ??
    identity.profile_image_url ??
    null;

  const normalizedHandle = handle?.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "-") ?? null;
  const updates: Record<string, unknown> = {
    twitter_user_id: twitterUserId,
    twitter_connected_at: new Date().toISOString(),
  };
  if (avatar) updates.avatar_url = avatar;
  if (handle) {
    updates.twitter_username = handle?.trim().replace(/^@/, "").replace(/\s+/g, "-") || null;
    if (normalizedHandle) updates.twitter_username = normalizedHandle;
  }

  const { error: updateError } = await supabase.from(PROFILES).update(updates).eq("id", userId);
  if (updateError) return { error: updateError.message };

  if (normalizedHandle) {
    const claim = await claimUsernameForProfile(normalizedHandle);
    if (claim.error) return claim;
  }
  return { error: null };
}

/** Disconnect X: clear connection state. Does NOT clear twitter_username unless clearUsername is true (user may want to keep handle). */
export async function disconnectTwitter(
  userId: string,
  options?: { clearUsername?: boolean }
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {
    twitter_connected_at: null,
    twitter_user_id: null,
    twitter_username_candidate: null,
  };
  if (options?.clearUsername) updates.twitter_username = null;
  const { error } = await supabase.from(PROFILES).update(updates).eq("id", userId);
  return { error: error?.message ?? null };
}
