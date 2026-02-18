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
  onboarding_completed_at: string | null;
  published: boolean;
  location: string | null;
  intents: string[];
  followers_total: number;
  avg_engagement_rate: number;
  created_at: string;
  updated_at: string;
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
