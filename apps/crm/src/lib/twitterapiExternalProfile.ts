/**
 * Server-only: twitterapi.io user/info for external (non-Linkary) handle lookup.
 * Same contract as web x-analytics-server fetchXUserInfo; duplicated to avoid CRM → web dependency.
 */
const TWITTERAPI_BASE = "https://api.twitterapi.io";

export type ExternalXProfilePayload = {
  followers?: number;
  following?: number;
  statusesCount?: number;
  favouritesCount?: number;
  name?: string;
  description?: string;
  profilePicture?: string;
  userName?: string;
};

export async function fetchExternalXUserInfo(
  userName: string,
  apiKey: string
): Promise<ExternalXProfilePayload | null> {
  const u = userName.trim().replace(/^@/, "").toLowerCase();
  if (!u) return null;
  const res = await fetch(`${TWITTERAPI_BASE}/twitter/user/info?userName=${encodeURIComponent(u)}`, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: ExternalXProfilePayload; status?: string };
  const data = json?.data;
  if (!data || json?.status === "error") return null;
  return data;
}
