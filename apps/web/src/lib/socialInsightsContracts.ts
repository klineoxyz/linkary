/**
 * Phase 4: Typed contracts for X insights cache payloads.
 * Used by /api/social/x/insights and refresh pipeline. No UI gating.
 */
import { isPrivateStorageUrl } from "./isPrivateStorageUrl";

// --- Item types (safe for API response) ---

export interface TopFollowerItem {
  name?: string;
  username: string;
  avatar?: string | null;
  score?: number | null;
  tier?: string | null;
  category?: "influencer" | "project" | "fund";
  followers?: number | null;
}

export interface AccountFeedItem {
  type: string;
  at: string;
  text?: string;
  username?: string;
  avatar?: string | null;
  meta?: unknown;
}

export interface MentionItem {
  at: string;
  tweet_id?: string;
  username: string;
  text?: string;
  url?: string;
}

// --- Cache payload shapes (stored in DB jsonb) ---

export interface XTopFollowersCachePayload {
  influencers: TopFollowerItem[];
  projects: TopFollowerItem[];
  funds: TopFollowerItem[];
}

export interface XAccountFeedCachePayload {
  actions: AccountFeedItem[];
  newFollowers: AccountFeedItem[];
}

export type XMentionsCachePayload = MentionItem[];

// --- Sanitize helpers ---

/** Never return Supabase private storage URLs in avatar; return null if private. */
export function stripPrivateStorageUrlsFromAvatar(url: string | null | undefined): string | null {
  if (url == null || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (isPrivateStorageUrl(trimmed)) return null;
  return trimmed;
}

/** Lowercase, trim, strip leading @. */
export function normalizeUsername(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  return s.trim().toLowerCase().replace(/^@/, "");
}

/** Sanitize a TopFollowerItem for response: safe avatar only. */
export function sanitizeTopFollowerItem(item: TopFollowerItem): TopFollowerItem {
  return {
    ...item,
    username: normalizeUsername(item.username) || item.username,
    avatar: stripPrivateStorageUrlsFromAvatar(item.avatar) ?? null,
  };
}

/** Sanitize an AccountFeedItem for response: safe avatar only. */
export function sanitizeAccountFeedItem(item: AccountFeedItem): AccountFeedItem {
  return {
    ...item,
    avatar: stripPrivateStorageUrlsFromAvatar(item.avatar) ?? null,
  };
}

/** Sanitize a MentionItem (no avatar in contract but safe for future). */
export function sanitizeMentionItem(item: MentionItem): MentionItem {
  return { ...item };
}
