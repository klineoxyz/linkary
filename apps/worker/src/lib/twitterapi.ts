export const TWITTERAPI_BASE = "https://api.twitterapi.io";

/** Canonical order: first found wins. Backward compat: TWITTERAPI_API_KEY is primary. */
const KEY_ENV_VARS = [
  "TWITTERAPI_API_KEY",
  "TWITTERAPI_IO_KEY",
  "TWITTERAPI_KEY",
  "TWITTERAPI_TOKEN",
] as const;

const AUTH_HEADER_NAME = "X-API-Key";

export type ProviderKeyInfo = {
  key: string;
  sourceVar: string;
  keyLen: number;
  keySuffix: string;
};

let keyInfoLogged = false;

/**
 * Resolve API key from env (multiple names supported). Use for requests.
 * Logs [X_PROVIDER] key_source/len/suffix once at first use (no secret).
 * Exported for provider selftest only; do not log the returned key.
 */
export function getApiKeyInfo(): ProviderKeyInfo {
  for (const name of KEY_ENV_VARS) {
    const raw = process.env[name];
    const key = typeof raw === "string" ? raw.trim() : "";
    if (key.length > 0) {
      const keySuffix = key.length >= 4 ? key.slice(-4) : "...";
      if (!keyInfoLogged) {
        keyInfoLogged = true;
        console.log(
          "[X_PROVIDER] key_source=" + name + " present=true len=" + key.length + " suffix=..." + keySuffix
        );
      }
      return { key, sourceVar: name, keyLen: key.length, keySuffix };
    }
  }
  throw new Error("Twitter API key not set. Set one of: " + KEY_ENV_VARS.join(", "));
}

/**
 * Safe for logging only: returns present + source/len/suffix without throwing.
 * Use in selftest or when key might be missing.
 */
export function getProviderKeyInfoForLog(): {
  present: boolean;
  sourceVar?: string;
  keyLen?: number;
  keySuffix?: string;
} {
  for (const name of KEY_ENV_VARS) {
    const raw = process.env[name];
    const key = typeof raw === "string" ? raw.trim() : "";
    if (key.length > 0) {
      const keySuffix = key.length >= 4 ? key.slice(-4) : "...";
      return { present: true, sourceVar: name, keyLen: key.length, keySuffix: "..." + keySuffix };
    }
  }
  return { present: false };
}

function getApiKey(): string {
  return getApiKeyInfo().key;
}

/** Log that auth is attached to the outgoing request (no secret). */
function logAuthAttached(): void {
  console.log("[X_PROVIDER] auth_header_present=true auth_header_name=" + AUTH_HEADER_NAME);
}

/** Log provider failure classification for 401/429/5xx. */
function logProviderFailure(status: number, keyPresent: boolean): void {
  if (status === 401) {
    console.error(
      "[X_PROVIDER] auth_invalid_or_missing auth_method=" + AUTH_HEADER_NAME + " key_present=" + keyPresent
    );
  } else if (status === 429) {
    console.error("[X_PROVIDER] rate_limited");
  } else if (status >= 500 && status < 600) {
    console.error("[X_PROVIDER] provider_down status=" + status);
  }
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
  const keyPresent = getProviderKeyInfoForLog().present;
  logAuthAttached();
  const res = await fetch(
    `${TWITTERAPI_BASE}/twitter/user/info?userName=${encodeURIComponent(u)}`,
    { headers: { [AUTH_HEADER_NAME]: getApiKey() } }
  );
  if (!res.ok) {
    logProviderFailure(res.status, keyPresent);
    return null;
  }
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

    const keyPresent = getProviderKeyInfoForLog().present;
    logAuthAttached();
    const res = await fetch(url, { headers: { [AUTH_HEADER_NAME]: getApiKey() } });

    const responseText = await res.text();
    if (!res.ok) {
      logProviderFailure(res.status, keyPresent);
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
