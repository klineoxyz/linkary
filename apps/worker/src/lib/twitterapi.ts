const TWITTERAPI_BASE = "https://api.twitterapi.io";

function getApiKey(): string {
  const key = process.env.TWITTERAPI_API_KEY;
  if (!key) {
    throw new Error("TWITTERAPI_API_KEY must be set");
  }
  return key;
}

export type UserInfo = {
  followers?: number;
  following?: number;
  statusesCount?: number;
  favouritesCount?: number;
  name?: string;
  description?: string;
  profilePicture?: string;
  userName?: string;
} & Record<string, unknown>;

export async function getUserInfo(username: string): Promise<UserInfo | null> {
  const u = username.trim().replace(/^@/, "");
  if (!u) return null;
  const res = await fetch(
    `${TWITTERAPI_BASE}/twitter/user/info?userName=${encodeURIComponent(u)}`,
    { headers: { "X-API-Key": getApiKey() } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const data = json?.data;
  if (!data || json?.status === "error") return null;
  return data as UserInfo;
}

export type TweetRaw = {
  id: string;
  text?: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  viewCount?: number;
  createdAt?: string;
} & Record<string, unknown>;

/**
 * Fetch recent tweets for a user (paginates; up to limit).
 * GET .../twitter/user/last_tweets?userName=... (cursor for next pages).
 */
export async function getRecentTweets(
  username: string,
  limit: number = 50
): Promise<TweetRaw[]> {
  const u = username.trim().replace(/^@/, "");
  if (!u) return [];
  getApiKey();
  const out: TweetRaw[] = [];
  let cursor = "";
  while (out.length < limit) {
    const params = new URLSearchParams({ userName: u });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(
      `${TWITTERAPI_BASE}/twitter/user/last_tweets?${params.toString()}`,
      { headers: { "X-API-Key": getApiKey() } }
    );
    if (!res.ok) break;
    const json = await res.json();
    const tweets: TweetRaw[] = json?.tweets ?? [];
    if (tweets.length === 0) break;
    for (const t of tweets) {
      if (out.length >= limit) break;
      out.push(t as TweetRaw);
    }
    if (!json?.has_next_page || !json?.next_cursor) break;
    cursor = json.next_cursor;
  }
  return out.slice(0, limit);
}
