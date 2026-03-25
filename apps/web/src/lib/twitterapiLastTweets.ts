/**
 * twitterapi.io /twitter/user/last_tweets — no @/ imports so CLI ingest can require this module.
 */

const TWITTERAPI_BASE = "https://api.twitterapi.io";

/** Tweet shape from twitterapi.io GET /twitter/user/last_tweets */
export type XTweetRaw = {
  id: string;
  text?: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  viewCount?: number;
  createdAt?: string;
};

/** Fetch up to `maxTweets` most recent tweets for a user. Paginates (20 per page). */
export async function fetchXUserTweets(
  userName: string,
  apiKey: string,
  maxTweets: number = 50
): Promise<XTweetRaw[]> {
  const u = userName.trim().replace(/^@/, "");
  if (!u) return [];
  const out: XTweetRaw[] = [];
  let cursor: string = "";
  while (out.length < maxTweets) {
    const params = new URLSearchParams({ userName: u });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`${TWITTERAPI_BASE}/twitter/user/last_tweets?${params.toString()}`, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) break;
    const json = (await res.json()) as {
      tweets?: XTweetRaw[];
      has_next_page?: boolean;
      next_cursor?: string;
    };
    const tweets: XTweetRaw[] = json?.tweets ?? [];
    if (tweets.length === 0) break;
    for (const t of tweets) {
      if (out.length >= maxTweets) break;
      out.push(t);
    }
    if (!json?.has_next_page || !json?.next_cursor) break;
    cursor = json.next_cursor;
  }
  return out.slice(0, maxTweets);
}

/** Parse twitterapi.io createdAt (e.g. "Tue Dec 10 07:00:30 +0000 2024") to ISO. */
export function parseTweetCreatedAt(createdAt: string | undefined): string | null {
  if (!createdAt || typeof createdAt !== "string") return null;
  const d = new Date(createdAt);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
