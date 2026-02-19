/**
 * Profile helpers: current user profile, ensure row, update.
 * Do not overwrite non-empty profiles.twitter_username in updates.
 */
import { supabase } from "./supabase";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  twitter_username: string | null;
  twitter_user_id?: string | null;
  twitter_connected_at?: string | null;
  twitter_username_candidate?: string | null;
  onboarding_completed_at: string | null;
  published: boolean;
  location: string | null;
  intents: string[];
  followers_total: number;
  avg_engagement_rate: number;
  created_at: string;
  updated_at: string;
};

/** Identity shape from Supabase auth (user.identities or provider raw_user_meta) */
export type TwitterIdentity = {
  provider: string;
  id?: string;
  sub?: string;
  user_name?: string;
  preferred_username?: string;
  username?: string;
  avatar_url?: string;
  picture?: string;
  profile_image_url?: string;
  /** X profile description (bio) when returned by OAuth */
  description?: string;
};

const PROFILES = "profiles";

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

/** Update current user's profile. Does NOT overwrite non-empty twitter_username. */
export async function updateMyProfile(
  userId: string,
  payload: {
    username?: string | null;
    display_name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    website?: string | null;
    twitter_username?: string | null;
    location?: string | null;
    intents?: string[];
    published?: boolean;
    onboarding_completed_at?: string | null;
    followers_total?: number;
    avg_engagement_rate?: number;
  }
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = { ...payload };
  if (updates.twitter_username !== undefined) {
    const { data: row } = await supabase.from(PROFILES).select("twitter_username").eq("id", userId).maybeSingle();
    if (row?.twitter_username && row.twitter_username.trim() !== "" && updates.twitter_username === "") {
      delete updates.twitter_username;
    }
  }
  if (Array.isArray(updates.intents)) {
    updates.intents = updates.intents;
  }
  const { error } = await supabase.from(PROFILES).update(updates).eq("id", userId);
  return { error: error?.message ?? null };
}

/**
 * Save X (Twitter) identity from OAuth into profiles.
 * Guardrail: do NOT overwrite profiles.twitter_username if already non-empty;
 * if different, store in twitter_username_candidate.
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

  const { data: row } = await supabase
    .from(PROFILES)
    .select("twitter_username")
    .eq("id", userId)
    .maybeSingle();

  const existingHandle = (row?.twitter_username ?? "").trim();
  const updates: Record<string, unknown> = {
    twitter_user_id: twitterUserId,
    twitter_connected_at: new Date().toISOString(),
  };
  if (avatar) updates.avatar_url = avatar;

  if (existingHandle && handle && existingHandle.toLowerCase() !== (handle ?? "").toLowerCase()) {
    updates.twitter_username_candidate = handle;
  } else if (handle) {
    updates.twitter_username = handle;
  }

  const { error } = await supabase.from(PROFILES).update(updates).eq("id", userId);
  return { error: error?.message ?? null };
}

/** Disconnect X: clear twitter_connected_at and twitter_user_id (UI-level only). */
export async function disconnectTwitter(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(PROFILES)
    .update({
      twitter_connected_at: null,
      twitter_user_id: null,
    })
    .eq("id", userId);
  return { error: error?.message ?? null };
}
