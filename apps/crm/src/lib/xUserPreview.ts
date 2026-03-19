/**
 * Server-only: fetch public X profile preview from twitterapi.io for CRM campaign definition UX.
 * Never expose API keys to the client.
 */

const TWITTERAPI_BASE = "https://api.twitterapi.io";

/** Normalize @handle, x.com/..., or raw handle to lowercase handle (no @). */
export function parseXHandleInput(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const noProto = raw.replace(/^https?:\/\//i, "");
  const noDomain = noProto
    .replace(/^www\./i, "")
    .replace(/^x\.com\//i, "")
    .replace(/^twitter\.com\//i, "");
  const firstSegment = noDomain.split(/[/?#]/)[0] ?? "";
  const handle = firstSegment.replace(/^@/, "").trim().toLowerCase();
  return handle;
}

export type XAccountPreview = {
  handle: string;
  display_name: string | null;
  bio: string | null;
  profile_image_url: string | null;
  followers: number | null;
  following: number | null;
  verified: boolean;
  profile_url: string;
};

export function getTwitterApiKeyFromEnv(): string | null {
  const key =
    process.env.TWITTERAPI_IO_KEY?.trim() ||
    process.env.TWITTERAPI_API_KEY?.trim() ||
    process.env.TWITTERAPI_KEY?.trim() ||
    "";
  return key || null;
}

function readVerified(data: Record<string, unknown>): boolean {
  const v =
    data.isBlueVerified ??
    data.isVerified ??
    data.verified ??
    data.blueVerified ??
    false;
  return v === true || v === "true";
}

/**
 * Returns null when API key missing, HTTP error, or user not found.
 */
export async function fetchXAccountPreview(userName: string, apiKey: string): Promise<XAccountPreview | null> {
  const u = userName.trim().replace(/^@/, "");
  if (!u || !/^[a-z0-9_]{1,15}$/i.test(u)) return null;

  const res = await fetch(`${TWITTERAPI_BASE}/twitter/user/info?userName=${encodeURIComponent(u)}`, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || json.status === "error") return null;
  const data = json.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return null;

  const rawHandle =
    (typeof data.userName === "string" && data.userName) ||
    (typeof data.username === "string" && data.username) ||
    (typeof data.screen_name === "string" && data.screen_name) ||
    u;
  const handle = String(rawHandle).replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/i.test(handle)) return null;

  const display_name =
    typeof data.name === "string" && data.name.trim() ? data.name.trim() : null;
  const bio = typeof data.description === "string" && data.description.trim() ? data.description.trim() : null;
  const profile_image_url =
    typeof data.profilePicture === "string" && data.profilePicture.trim()
      ? data.profilePicture.trim()
      : null;

  const followers = typeof data.followers === "number" ? data.followers : null;
  const following = typeof data.following === "number" ? data.following : null;

  return {
    handle,
    display_name,
    bio,
    profile_image_url,
    followers,
    following,
    verified: readVerified(data),
    profile_url: `https://x.com/${encodeURIComponent(handle)}`,
  };
}
