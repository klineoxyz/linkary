# XSpaces Provider Audit and Standardization Plan

## PART 1 — SOURCE OF TRUTH AUDIT

### 1. Which routes currently fetch X Spaces data from the official X API?

| Route | Endpoint called | Helper |
|-------|-----------------|--------|
| **GET /api/xspaces/my-x-spaces** | `https://api.twitter.com/2/spaces/by/creator_ids?user_ids=...` | `fetchSpacesByCreatorId()` in x-analytics-server.ts → `xApiFetchSafe()` in x-api-client.ts (Bearer token) |
| **POST /api/xspaces/detect-my-space** | Same | Same |
| **POST /api/spaces/sync-from-x** | When `TWITTERAPI_API_KEY` is unset or `fetchXSpaceDetail` returns null: `https://api.twitter.com/2/spaces/{id}?space.fields=...` | `fetchXSpaceByIdV2()` → `xApiFetchSafe()` (Bearer token) |

### 2. Which routes currently fetch from twitterapi.io?

| Route | Endpoint called | Helper |
|-------|-----------------|--------|
| **POST /api/spaces/sync-from-x** | When `TWITTERAPI_API_KEY` is set: `https://api.twitterapi.io/twitter/spaces/detail?space_id=...` (X-API-Key) | `fetchXSpaceDetail()` in x-analytics-server.ts (plain fetch, no user token) |

### 3. Helpers / libs responsible for each fetch path

| Lib / helper | Responsibility | Auth |
|-------------|----------------|------|
| **x-api-client.ts** | `xApiFetch` / `xApiFetchSafe`: official X API v2, timeout, normalized XApiResult (X_RECONNECT_NEEDED, X_RATE_LIMITED, etc.) | User Bearer (access_token from x_oauth_tokens) |
| **x-analytics-server.ts** | `fetchSpacesByCreatorId` (X API by/creator_ids), `fetchXSpaceByIdV2` (X API spaces/{id}), `fetchXSpaceDetail` (twitterapi.io spaces/detail) | Bearer for X; X-API-Key for twitterapi.io |
| **twitterapiClient.ts** | Generic twitterapi.io fetch with retry on 429/5xx; used elsewhere (e.g. refresh insights), not currently used for Spaces | X-API-Key (TWITTERAPI_IO_KEY or TWITTERAPI_API_KEY) |

### 4. Is production currently mixed?

**Yes.** Production is mixed:

- **my-x-spaces** and **detect-my-space**: 100% official X API (api.twitter.com/2/spaces/by/creator_ids). Require user X OAuth.
- **sync-from-x**: Tries twitterapi.io first when `TWITTERAPI_API_KEY` is set; on success uses it; on null falls back to official X API (api.twitter.com/2/spaces/{id}). So both providers can be used for the same route depending on config and response.

---

## Intended provider by route (from product)

- **Space-by-ID (import/sync):** twitterapi.io when configured (single Space detail). No dependency on official X API for this lookup when twitterapi.io is available.
- **Spaces-by-creator (list my spaces, detect):** twitterapi.io does **not** offer an equivalent (no “spaces by creator” or “list user spaces” in [twitterapi.io docs](https://docs.twitterapi.io/llms.txt)). Only “Get Space Detail” exists. So list/detect must stay on official X API until twitterapi.io adds such an endpoint.

---

## Mismatch list

| Route | Current | Intended | Mismatch |
|-------|---------|----------|----------|
| **my-x-spaces** | Official X API only | N/A (no twitterapi.io list endpoint) | None; X API is the only option. |
| **detect-my-space** | Official X API only | N/A (same) | None. |
| **sync-from-x** | twitterapi.io first, then **fallback to official X API** | twitterapi.io **only** when key set (no X API fallback for this flow) | When key is set we should not fall back to X API; when key is not set we can keep X API path for backward compatibility. |

---

## PART 2 — STANDARDIZE ON TWITTERAPI.IO WHERE POSSIBLE

- **sync-from-x:** When `TWITTERAPI_IO_KEY` or `TWITTERAPI_API_KEY` is set, use **only** twitterapi.io for Space-by-ID (no fallback to official X API). When key is not set, keep existing X API path so deployments without the key still work.
- **my-x-spaces / detect-my-space:** Keep official X API (no twitterapi.io equivalent for list-by-creator). Document clearly.

Deliverables:
1. One shared helper for “Space by ID” that uses twitterapi.io when key exists; normalized result shape; safe timeout/parse/non-200; no token leakage.
2. Same helper used by sync-from-x for the “get Space detail” step.
3. Keep existing X API helpers for list-by-creator and for sync-from-x when provider key is not set.

---

## PART 3 — OAUTH VS PROVIDER CREDENTIALS

1. **Does twitterapi.io require the user’s official X OAuth for Spaces endpoints?**  
   **No.** Get Space Detail uses **X-API-Key** only (server-side key). No user access_token.

2. **Linkary usage:**  
   - **sync-from-x (twitterapi.io path):** Needs only session (who is importing) and server-side `TWITTERAPI_IO_KEY` / `TWITTERAPI_API_KEY`. Host check is done via `detail.creator.userName` from twitterapi.io response vs `social_accounts.username`.  
   - **sync-from-x (X API fallback when no key):** Needs user’s x_oauth_tokens (access_token, refresh_token, x_user_id) for Bearer call and host check.  
   - **my-x-spaces / detect-my-space:** Need user’s X OAuth (x_oauth_tokens) because they call official X API (spaces by creator).

3. **Correct model:**  
   - User auth / Connect X: stays for my-x-spaces, detect-my-space, and for sync-from-x when using X API path.  
   - Spaces data provider: sync-from-x uses twitterapi.io (key only) when configured; my-x-spaces and detect-my-space use X API (user token) only.

---

## PART 4 — PROVIDER-SPECIFIC ERROR MAPPING

- **twitterapi.io path:** Map to Linkary codes:  
  `PROVIDER_AUTH_FAILED`, `PROVIDER_RATE_LIMITED`, `PROVIDER_QUOTA_EXHAUSTED`, `PROVIDER_TIMEOUT`, `PROVIDER_INVALID_RESPONSE`, `PROVIDER_UNAVAILABLE`, `SPACE_NOT_FOUND`, `PROVIDER_NOT_CONFIGURED` (when key missing for a path that requires it).
- **X API path (unchanged):** Keep `X_RECONNECT_NEEDED`, `X_RATE_LIMITED`, `X_API_TIMEOUT`, `INVALID_X_RESPONSE`, `X_API_FAILED`, `SPACE_NOT_FOUND`.

Sync-from-x: when using twitterapi.io, return 502/429/503 with these provider codes; when using X API, keep existing X_* codes.

---

## PART 5 — CLIENT UX MESSAGE CORRECTION (XSpacesPage)

- Minimal copy changes only; no redesign.
- Map backend codes to truthful messages, e.g.:
  - `PROVIDER_QUOTA_EXHAUSTED` / `PROVIDER_RATE_LIMITED` → “The X data provider quota/rate limit is reached. Try again later.”
  - `PROVIDER_TIMEOUT` / `PROVIDER_UNAVAILABLE` → “The X data provider is temporarily unavailable. Try again.”
  - `PROVIDER_NOT_CONFIGURED` → “Import from X is not configured. Please try again later.” (or keep generic)
  - Reconnect X when code is `X_RECONNECT_NEEDED` / `X_NOT_CONNECTED` → “Reconnect X to continue.”

---

## PART 6 — SHARED PROVIDER ABSTRACTION

- **New shared layer:** One module (e.g. `xspaces-data-provider.ts`) that:
  - **fetchSpaceByIdProvider(spaceId):** If provider key set → call twitterapi.io only; return normalized `{ ok, provider: 'twitterapi.io', status, code, data, retryable, message }`. If key not set and caller is sync-from-x → return `{ ok: false, code: 'PROVIDER_NOT_CONFIGURED' }` or allow fallback to X API (current behavior).
  - Routes consume this normalized shape; provider-specific URLs, auth headers, and error mapping stay inside the layer.

- **List-by-creator:** No change to fetch path; keep using `fetchSpacesByCreatorId` (X API). No twitterapi.io equivalent.

---

## PART 7 — DEBUG / OBSERVABILITY

- Env-gated logs remain; add provider awareness:
  - Log which provider was used (twitterapi.io vs x_api), endpoint family, whether required credentials existed, provider HTTP status, normalized final_code, and whether fallback/retry happened.
  - Never log tokens, cookies, auth headers, secret keys, or raw sensitive payloads.

---

## PART 8 — INDEX / QUERY CHECK

- **x_oauth_tokens:** Used by my-x-spaces, detect-my-space, and sync-from-x (X API path). Lookup: `profile_id` + `provider = 'x'`. Existing index on (profile_id, provider) is sufficient; no new index needed.
- **Provider credential:** Only env `TWITTERAPI_IO_KEY` / `TWITTERAPI_API_KEY`; no DB lookup. No index needed.

**Conclusion:** No new DB index required.

---

## Risks / compatibility notes

- Removing X API fallback for sync-from-x when key is set may fix 502s for deployments that have the key but were still hitting X API (e.g. when twitterapi.io returned null). Those flows will now rely only on twitterapi.io for that path.
- Deployments without `TWITTERAPI_IO_KEY`/`TWITTERAPI_API_KEY` keep current behavior (X API path for sync-from-x).
- my-x-spaces and detect-my-space unchanged in provider choice (still X API); only sync-from-x gets standardized on twitterapi.io when key is set.

---

## DELIVERABLES (post-implementation)

### 1. Files changed

- **Added:** `apps/web/src/lib/xspaces-data-provider.ts` — shared Space-by-ID via twitterapi.io; normalized result and provider codes.
- **Modified:** `apps/web/src/app/api/spaces/sync-from-x/route.ts` — use twitterapi.io only when key set (no X API fallback); provider error mapping; provider-aware debug.
- **Modified:** `apps/web/src/figma/app/components/XSpacesPage.tsx` — show backend `data.error` for 502/503 (provider messages).
- **Modified:** `apps/web/src/app/api/xspaces/my-x-spaces/route.ts` — add `provider: "x_api"` to PRODUCTION_VERIFY.
- **Modified:** `apps/web/src/app/api/xspaces/detect-my-space/route.ts` — add `provider: "x_api"` to PRODUCTION_VERIFY.
- **Modified:** `apps/web/src/app/api/spaces/sync-from-x/route.ts` — add `provider: "x_api"` to PRODUCTION_VERIFY when on X API path.
- **Added:** `docs/XSPACES_PROVIDER_AUDIT_AND_PLAN.md` — audit, plan, and deliverables.

### 2. Exact provider used now per route

| Route | Provider when configured | Provider when not configured |
|-------|---------------------------|------------------------------|
| **GET /api/xspaces/my-x-spaces** | N/A | Official X API only (no twitterapi.io list endpoint). |
| **POST /api/xspaces/detect-my-space** | N/A | Official X API only. |
| **POST /api/spaces/sync-from-x** | **twitterapi.io only** (when TWITTERAPI_IO_KEY or TWITTERAPI_API_KEY set) | Official X API (x_oauth_tokens + refresh/retry). |

### 3. Shared provider/helper summary

- **xspaces-data-provider.ts:** `fetchSpaceByIdFromTwitterApi(spaceId)` — calls twitterapi.io GET /twitter/spaces/detail; returns normalized `SpaceByIdResult` (ok, provider, status, code, data, retryable). `isTwitterApiSpacesConfigured()` — true when key is set. No user OAuth; no fallback to X API.
- **x-analytics-server.ts:** Unchanged for list: `fetchSpacesByCreatorId`, `fetchXSpaceByIdV2` (used only when sync-from-x has no provider key).

### 4. Final error-code mapping

- **sync-from-x (twitterapi.io path):** SPACE_NOT_FOUND (404), PROVIDER_NOT_CONFIGURED (503), PROVIDER_AUTH_FAILED, PROVIDER_RATE_LIMITED, PROVIDER_QUOTA_EXHAUSTED, PROVIDER_TIMEOUT, PROVIDER_INVALID_RESPONSE, PROVIDER_UNAVAILABLE (502/429 as in route).
- **sync-from-x (X API path):** Unchanged: X_RECONNECT_NEEDED, X_RATE_LIMITED, SPACE_NOT_FOUND, X_API_TIMEOUT, X_API_FAILED, X_NOT_HOST.
- **my-x-spaces / detect-my-space:** Unchanged: X_RECONNECT_NEEDED, X_RATE_LIMITED, X_API_TIMEOUT, INVALID_X_RESPONSE, X_API_FAILED.

### 5. Client UX mapping summary

- 502/503/404 from sync-from-x: show `data.error` from backend (provider or X messages) instead of generic "X or our service is temporarily unavailable" when backend sends a message.
- No redesign; paste-link fallback and success flows preserved.

### 6. Index added or confirmed unnecessary

- **x_oauth_tokens:** Lookup by (profile_id, provider). No new index added; existing index sufficient.
- **Provider credentials:** Env only; no DB. No index.

### 7. Manual QA checklist

- [ ] Set TWITTERAPI_IO_KEY or TWITTERAPI_API_KEY in Vercel. Add from X (sync-from-x) with a valid Space link: expect success and space created; logs show SYNC_PROVIDER_USED "twitterapi.io".
- [ ] With provider key set, use an invalid Space ID or URL: expect 404 SPACE_NOT_FOUND or 400 INVALID_URL; no call to official X API.
- [ ] Unset provider key; Add from X with valid link and connected X: expect sync-from-x to use X API path (PRODUCTION_VERIFY provider "x_api"); success or X_RECONNECT_NEEDED as before.
- [ ] my-x-spaces: connect X, open Add from X; list loads from X API; PRODUCTION_VERIFY shows provider "x_api".
- [ ] detect-my-space: detect live Space; PRODUCTION_VERIFY shows provider "x_api".
- [ ] Speaker applications, sponsor proposals, payout preferences, notifications, my-proposals, analytics, reputation, public credibility, profile/dashboard, GET /api/spaces/[id]: unchanged behavior.
- [ ] No tokens, API keys, or auth headers in logs.

### 8. Confirmation: Add from X and unrelated systems not broken

- Add from X: still uses sync-from-x; when key set uses twitterapi.io only; when key not set uses X API path with refresh/retry. Session and host check unchanged.
- my-x-spaces flow: unchanged (X API list).
- detect-my-space flow: unchanged (X API list).
- sync-from-x flow: provider path standardized when key set; X API path unchanged when key not set.
- Speaker applications, sponsor proposals, payout preferences, notifications, my-proposals, analytics, reputation, public credibility, profile/dashboard, GET /api/spaces/[id] visibility: not modified.
