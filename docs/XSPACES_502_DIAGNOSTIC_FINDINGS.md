# XSpaces 502 — Diagnostic Implementation & Findings Reference

## Purpose

Minimal diagnostic changes to identify the exact failing stage and X API response for:

- `POST /api/xspaces/detect-my-space`
- `POST /api/spaces/sync-from-x`

No business logic, route shape, or response shape changes.

---

## 1. Env-gated debug logs (implemented)

When **DEBUG_DETECT_MY_SPACE=1** or **DEBUG_SYNC_FROM_X=1** (or `"true"`), the following are logged.

### Logged (safe)

- Which X API endpoint is called (`X_API_CALL_START` with `endpoint`, `access_token_exists`, `x_user_id_exists`)
- HTTP status returned by X (`X_API_CALL_RESPONSE { status }`)
- Request duration in ms (`X_API_CALL_DURATION { ms }`)
- When X returns non-200: sanitized response body (`X_API_CALL_BODY`), with tokens/headers redacted and length capped

### Never logged

- Access tokens, refresh tokens, Authorization headers, cookies

### Example output

```
X_API_CALL_START { "endpoint": "https://api.twitter.com/2/spaces/by/creator_ids?user_ids=REDACTED&space.fields=...", "access_token_exists": true, "x_user_id_exists": true }
X_API_CALL_RESPONSE { "status": 401 }
X_API_CALL_DURATION { "ms": 1200 }
X_API_CALL_BODY { "errors": [{ "message": "..." }] }
```

---

## 2. Exact X API endpoints in use

### detect-my-space

- **Endpoint:** `GET https://api.twitter.com/2/spaces/by/creator_ids`
- **Query params:** `user_ids=<x_user_id>`, `space.fields=created_at,state,title,id,scheduled_start`
- **Authorization:** `Bearer <access_token>` (from `x_oauth_tokens`)
- **Location:** `apps/web/src/app/api/xspaces/detect-my-space/route.ts` (inline fetch with 8s timeout)

### sync-from-x

- **Endpoint:** `GET https://api.twitter.com/2/spaces/{space_id}`
- **Query params:** `space.fields=title,state,created_at,scheduled_start,host_ids`
- **Authorization:** `Bearer <access_token>` (from `x_oauth_tokens`)
- **Location:** `apps/web/src/lib/x-analytics-server.ts` — `fetchXSpaceByIdV2(spaceId, accessToken)`

So:

- **detect-my-space** uses **/2/spaces/by/creator_ids** (list spaces by creator).
- **sync-from-x** uses **/2/spaces/{id}** (lookup single space by ID).

Both match X API v2 Spaces lookup (GET /2/spaces and GET /2/spaces/by/creator_ids). Authorization format is `Bearer <access_token>` in both.

---

## 3. Token scope (space.read)

- **Connect X** requests scope: `tweet.read users.read space.read offline.access` (`apps/web/src/app/api/x/connect/route.ts`).
- X API Spaces lookup requires **space.read** (and commonly tweet.read, users.read). Our requested scope is valid for Spaces.
- Stored token is in `x_oauth_tokens`; callback stores `scope: tokenData.scope ?? null`. We do not re-validate scope on each request; if X returns 403 Forbidden or insufficient scope, the new debug logs will show the HTTP status and sanitized body.

**Confirmation:** The OAuth flow requests **space.read**. The stored `access_token` in `x_oauth_tokens` is the one returned by X for that scope. Validity for Spaces is confirmed by (1) requested scope at connect time and (2) production logs when DEBUG flags are set (status + body).

---

## 4. How to get the findings (after deploy)

1. Set in Vercel (or env):
   - `DEBUG_DETECT_MY_SPACE=1` for detect-my-space
   - `DEBUG_SYNC_FROM_X=1` for sync-from-x
2. Reproduce the 502 (valid Bearer, X connected, rate limit not hit).
3. In logs, read:
   - **Exact X API endpoint** — from `X_API_CALL_START` (already documented above).
   - **HTTP status returned by X** — from `X_API_CALL_RESPONSE { status }`.
   - **Sanitized error body** — from `X_API_CALL_BODY` when status is non-200.
   - **access_token_exists / x_user_id_exists** — from `X_API_CALL_START`.
   - **Duration** — from `X_API_CALL_DURATION { ms }`.

### Failing stage

- **detect-my-space:** Last stage before 502 will be one of:
  - After `X_API_CALL_START` but no `X_API_CALL_RESPONSE` → fetch threw (e.g. timeout/network) or process killed.
  - `X_API_CALL_RESPONSE` with non-200 → X returned error; see `X_API_CALL_BODY` for body.
  - `DETECT_STAGE_FAIL_X_API` → same as above (we return 502).
  - `DETECT_STAGE_FAIL_INVALID_RESPONSE` → X returned 200 but body was not JSON.

- **sync-from-x:** Last stage before 502 will be one of:
  - `SYNC_STAGE_TOKEN_ROW_FOUND` + `X_API_CALL_START` but no `X_API_CALL_RESPONSE` → fetch in `fetchXSpaceByIdV2` threw or process killed.
  - `X_API_CALL_RESPONSE` with non-200 → X returned error; see `X_API_CALL_BODY`.
  - `SYNC_STAGE_FAIL_X_FETCH` → throw inside `fetchXSpaceByIdV2`.
  - `SYNC_STAGE_FAIL_X_NO_DATA` → X returned 200 but null/empty or invalid JSON.

---

## 5. Files changed (diagnosis only)

| File | Change |
|------|--------|
| `apps/web/src/lib/server-error.ts` | `sanitizeResponseBody()` added; used for non-200 body logging. |
| `apps/web/src/app/api/xspaces/detect-my-space/route.ts` | When `DEBUG_DETECT_MY_SPACE=1`: log `X_API_CALL_START` (endpoint, access_token_exists, x_user_id_exists), timing, `X_API_CALL_RESPONSE`, `X_API_CALL_DURATION`; on `!res.ok` capture and log sanitized body. |
| `apps/web/src/app/api/spaces/sync-from-x/route.ts` | When `DEBUG_SYNC_FROM_X=1`: log `X_API_CALL_START` (endpoint, access_token_exists, x_user_id_exists) before `fetchXSpaceByIdV2`. |
| `apps/web/src/lib/x-analytics-server.ts` | In `fetchXSpaceByIdV2`, when `DEBUG_SYNC_FROM_X=1`: log `X_API_CALL_RESPONSE`, `X_API_CALL_DURATION`; on `!res.ok` capture and log sanitized body. |

No changes to response shapes, status codes, or business logic.

---

## 6. Summary checklist (to fill after production run)

- [ ] **Exact X API endpoint used** — see §2; confirm in logs via `X_API_CALL_START`.
- [ ] **HTTP status returned by X** — from `X_API_CALL_RESPONSE`.
- [ ] **Sanitized error body** — from `X_API_CALL_BODY` when status ≠ 200.
- [ ] **OAuth token scope valid for Spaces** — requested scope is `space.read` (§3); use status/body to confirm if 403 is scope-related.
- [ ] **Stage that fails in detect-my-space** — use §4 (detect) and log sequence.
- [ ] **Stage that fails in sync-from-x** — use §4 (sync) and log sequence.
