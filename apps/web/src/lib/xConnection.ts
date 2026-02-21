/**
 * X connection: single source of truth for "is X connected".
 * Connected if ANY of: user.identities (twitter/x), getUserIdentities(), user_metadata (X provider), profile, or social_accounts.
 */
import { supabase } from "./supabase";
import { getMyProfile } from "./profiles";
import type { User } from "@supabase/supabase-js";

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

export type XIdentityResult = { username: string | null; user_id: string };

/** Extract X identity from Supabase user (identities or user_metadata). Returns null only if no X linked. */
export function getUserXIdentity(user: User | null | undefined): XIdentityResult | null {
  if (!user || typeof user !== "object") return null;
  const u = user as unknown as { identities?: Array<Record<string, unknown>>; user_metadata?: Record<string, unknown> };
  const identities = u.identities ?? [];
  const twitter = identities.find((i) => isXProvider(i.provider)) as Record<string, unknown> | undefined;
  const raw = (twitter ? (twitter.identity_data ?? twitter) : {}) as Record<string, unknown>;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const merged = { ...meta, ...raw };
  const username = firstStr(merged, "user_name", "preferred_username", "username", "screen_name", "nickname");
  const user_id = firstStr(merged, "id", "sub") ?? (raw.id as string) ?? (raw.sub as string) ?? "";
  if (twitter) {
    return { username: username ? username.replace(/^@/, "") : null, user_id: user_id || (twitter.id as string) || "" };
  }
  const metaProvider = (meta.provider as string)?.toLowerCase();
  const isMetaX = metaProvider === "twitter" || metaProvider === "x" || (typeof meta.iss === "string" && meta.iss.includes("twitter"));
  if (isMetaX || (firstStr(meta, "user_name", "preferred_username", "username", "screen_name") && (metaProvider || meta.iss))) {
    return { username: username ? username.replace(/^@/, "") : null, user_id: user_id || (meta.sub as string) || (meta.id as string) || "" };
  }
  return null;
}

export type MyXConnectionStatus = {
  connected: boolean;
  /** Where we determined connected from */
  source: "identity" | "profile" | "social_accounts";
  username: string | null;
  user_id: string | null;
  /** True if user has X identity but profile/social_accounts are missing or stale (show "Sync X data") */
  profileStale?: boolean;
};

/** Build X identity from getUserIdentities() item (provider + identity_data). */
function identityFromApiRow(i: Record<string, unknown>): XIdentityResult | null {
  if (!isXProvider(i.provider)) return null;
  const raw = (i.identity_data ?? i) as Record<string, unknown>;
  const username = firstStr(raw, "user_name", "preferred_username", "username", "screen_name", "nickname");
  const user_id = firstStr(raw, "id", "sub") ?? (i.id as string) ?? "";
  return { username: username ? username.replace(/^@/, "") : null, user_id };
}

/**
 * Single source of truth for "is X connected" for the current user.
 * X is connected if ANY of:
 * A) user.identities or getUserIdentities() includes provider twitter/x
 * B) user_metadata indicates X (provider/iss)
 * C) profile.twitter_user_id / twitter_connected_at / twitter_username
 * D) social_accounts has connected x row
 * Pass optional `user` from supabase.auth.getUser() for server-validated identities.
 */
export async function getMyXConnection(userId: string, userFromGetUser?: User | null): Promise<MyXConnectionStatus> {
  let user =
    userFromGetUser ??
    (await supabase.auth.getSession()).data?.session?.user ??
    null;
  if (!user && userId) {
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u ?? null;
  }
  const profile = await getMyProfile(userId);
  let identity = getUserXIdentity(user);

  if (!identity && user?.id) {
    const { data: identitiesData } = await supabase.auth.getUserIdentities();
    const list = identitiesData?.identities ?? [];
    const xRow = list.find((i: { provider?: string }) => isXProvider(i?.provider));
    if (xRow) identity = identityFromApiRow(xRow as unknown as Record<string, unknown>);
  }

  const hasProfileX =
    !!(profile?.twitter_user_id ?? profile?.twitter_connected_at ?? (profile?.twitter_username && String(profile.twitter_username).trim().length > 0));

  const { data: socialRow } = await supabase
    .from("social_accounts")
    .select("username, status, revoked_at")
    .eq("user_id", userId)
    .eq("provider", "x")
    .maybeSingle();
  const hasSocial = !!(socialRow && socialRow.status === "connected" && !socialRow.revoked_at);

  if (identity) {
    const profileStale = !hasProfileX || !hasSocial;
    const username =
      identity.username ?? socialRow?.username ?? profile?.twitter_username ?? profile?.twitter_username_candidate ?? null;
    return {
      connected: true,
      source: "identity",
      username: username ? String(username).replace(/^@/, "") : null,
      user_id: identity.user_id || null,
      profileStale,
    };
  }
  if (hasProfileX || hasSocial) {
    const username =
      socialRow?.username ?? profile?.twitter_username ?? profile?.twitter_username_candidate ?? null;
    return {
      connected: true,
      source: hasSocial ? "social_accounts" : "profile",
      username: username ? String(username).replace(/^@/, "") : null,
      user_id: profile?.twitter_user_id ?? null,
    };
  }
  return {
    connected: false,
    source: "profile",
    username: null,
    user_id: null,
  };
}
