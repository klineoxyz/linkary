/**
 * Extract X (Twitter) identity from Supabase auth user. Server-safe (no Supabase client).
 * Used by auth callback and sync-session-x API.
 */

export type TwitterIdentity = {
  provider: string;
  id?: string;
  sub?: string;
  user_name?: string;
  preferred_username?: string;
  username?: string;
  name?: string;
  avatar_url?: string;
  picture?: string;
  profile_image_url?: string;
  description?: string;
};

function firstStr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

export function extractTwitterIdentity(user: {
  identities?: Array<Record<string, unknown>>;
  user_metadata?: Record<string, unknown>;
}): TwitterIdentity | null {
  const identities = user?.identities ?? [];
  const twitter = identities.find((i) => {
    const p = (i.provider as string)?.toLowerCase();
    return p === "twitter" || p === "x";
  });
  const rawIdentity = (twitter ? (twitter.identity_data ?? twitter) : {}) as Record<string, unknown>;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const isTwitter =
    !!twitter ||
    ["twitter", "x"].includes((meta.provider as string)?.toLowerCase()) ||
    (typeof meta.iss === "string" && meta.iss.includes("twitter"));
  if (!isTwitter && Object.keys(rawIdentity).length === 0) return null;

  const merged = { ...meta, ...rawIdentity };
  const handle = firstStr(merged, "user_name", "preferred_username", "username", "screen_name", "nickname");
  const name = firstStr(merged, "name", "full_name", "display_name");
  const description = firstStr(merged, "description", "bio");
  const avatar =
    firstStr(merged, "avatar_url", "picture", "profile_image_url", "image", "profile_image_url_https") ||
    (merged.picture as string | undefined);
  const sub = (merged.sub ?? merged.id ?? (twitter as Record<string, unknown>)?.["id"]) as string | undefined;

  return {
    provider: "twitter",
    id: (merged.id as string) ?? sub,
    sub,
    user_name: handle,
    preferred_username: handle,
    username: handle,
    name: name ?? undefined,
    avatar_url: avatar ?? undefined,
    picture: avatar ?? undefined,
    profile_image_url: avatar ?? undefined,
    description: description ?? undefined,
  };
}
