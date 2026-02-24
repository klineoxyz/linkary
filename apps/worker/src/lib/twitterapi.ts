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

export type ExtractTweetsResult = { tweets: TweetRaw[]; location: string };

/**
 * Extract tweets array from API response. Tries root.tweets first, then data.* fallbacks.
 */
export function extractTweetsFromResponse(resp: unknown): ExtractTweetsResult {
  const r = resp as Record<string, unknown>;
  if (!r || typeof r !== "object") return { tweets: [], location: "none" };
  if (Array.isArray(r.tweets))
    return { tweets: r.tweets as TweetRaw[], location: "root.tweets" };
  const data = r.data as Record<string, unknown> | undefined;
  if (data && typeof data === "object") {
    if (Array.isArray(data.tweets))
      return { tweets: data.tweets as TweetRaw[], location: "data.tweets" };
    if (Array.isArray(data.items))
      return { tweets: data.items as TweetRaw[], location: "data.items" };
    if (Array.isArray(data.list))
      return { tweets: data.list as TweetRaw[], location: "data.list" };
    if (Array.isArray(data))
      return { tweets: data as TweetRaw[], location: "data" };
  }
  return { tweets: [], location: "none" };
}

/** Safe snippet for logs: first 300 chars, no secrets */
function responseSnippet(body: string): string {
  const s = String(body ?? "").slice(0, 300);
  return s.replace(/\b(?:X-API-Key|api[_-]?key|Bearer)\s*[:=]\s*[\w-]+/gi, "[REDACTED]");
}

/**
 * Fetch recent tweets for a user (paginates; up to limit).
 * GET .../twitter/user/last_tweets — params: userName, cursor, includeReplies (no since/until).
 * Fails loudly on non-200 or API error; logs request params and response shape (no secrets).
 */
export async function getRecentTweets(
  username: string,
  limit: number = 50
): Promise<TweetRaw[]> {
  const u = username.trim().replace(/^@/, "");
  if (!u) {
    console.error("[X_TWEETS] getRecentTweets: empty username after normalize");
    return [];
  }
  getApiKey();

  const out: TweetRaw[] = [];
  let cursor = "";
  let pageNum = 0;

  while (out.length < limit) {
    const params = new URLSearchParams({ userName: u, includeReplies: "false" });
    if (cursor) params.set("cursor", cursor);

    const pathWithQuery = "/twitter/user/last_tweets?" + params.toString();
    const url = TWITTERAPI_BASE + pathWithQuery;
    console.log("[X_TWEETS] url_path=" + pathWithQuery);
    const queryParamsLog = Object.fromEntries(params.entries());
    console.log("[X_TWEETS] request params (no key)", JSON.stringify(queryParamsLog));

    const res = await fetch(url, { headers: { "X-API-Key": getApiKey() } });

    const responseText = await res.text();
    if (!res.ok) {
      console.error(
        "[X_TWEETS] HTTP error status=" + res.status + " body_snippet=" + responseSnippet(responseText)
      );
      throw new Error(
        `twitterapi.io last_tweets failed: status=${res.status} body=${responseSnippet(responseText)}`
      );
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(responseText) as Record<string, unknown>;
    } catch (e) {
      console.error("[X_TWEETS] invalid JSON response_snippet=" + responseSnippet(responseText));
      throw new Error("twitterapi.io last_tweets returned invalid JSON");
    }

    if (json.status === "error" || json.error != null) {
      const msg = String(json.message ?? json.msg ?? json.error ?? "Unknown API error");
      console.error("[X_TWEETS] API error status=" + json.status + " message=" + msg);
      throw new Error("[X_TWEETS] twitterapi.io error: " + msg);
    }

    const { tweets, location } = extractTweetsFromResponse(json);
    const hasNext = Boolean(json.has_next_page && json.next_cursor);

    const topKeys = Object.keys(json).join(",");
    console.log("[X_TWEETS] response keys=" + topKeys + " tweets_location=" + location + " tweets_len=" + tweets.length);
    if (tweets.length > 0) {
      const first = tweets[0] as Record<string, unknown>;
      console.log("[X_TWEETS] first tweet id=" + (first?.id ?? "?") + " createdAt=" + (first?.createdAt ?? "?"));
    }

    if (tweets.length === 0) {
      if (out.length === 0) {
        console.log("[X_TWEETS] 200 OK but no tweets in response. keys=" + topKeys);
      }
      break;
    }

    for (const t of tweets) {
      if (out.length >= limit) break;
      out.push(t as TweetRaw);
    }

    if (!hasNext) break;
    cursor = String(json.next_cursor ?? "");
    pageNum += 1;
  }

  return out.slice(0, limit);
}
