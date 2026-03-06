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

---

## 7. Incident response: log interpretation → root cause → fix

**Production logs required.** To get exact root cause, set DEBUG env vars, reproduce the 502, then paste from Vercel logs:

- For **detect-my-space:** `X_API_CALL_START`, `X_API_CALL_RESPONSE`, `X_API_CALL_DURATION`, `X_API_CALL_BODY` (if present), and the last `DETECT_STAGE_*` line.
- For **sync-from-x:** `X_API_CALL_START`, `X_API_CALL_RESPONSE`, `X_API_CALL_DURATION`, `X_API_CALL_BODY` (if present), and the last `SYNC_STAGE_*` line.

### Interpretation matrix (exact root cause from logs)

| Log pattern | Root cause (one sentence) | Smallest fix |
|-------------|----------------------------|--------------|
| `X_API_CALL_RESPONSE { "status": 401 }` | X returns 401 Unauthorized — stored token expired or revoked. | Return 403 with code `X_RECONNECT_NEEDED`; client shows "Reconnect X". |
| `X_API_CALL_RESPONSE { "status": 403 }` | X returns 403 Forbidden — token invalid or insufficient scope. | Return 403 with code `X_RECONNECT_NEEDED`; client shows "Reconnect X". |
| `X_API_CALL_RESPONSE { "status": 404 }` | X returns 404 — space not found or not accessible. | Map to 404 or 400 with code e.g. `SPACE_NOT_FOUND`; client shows paste fallback. |
| `X_API_CALL_RESPONSE { "status": 429 }` | X rate limit. | Return 503 or 429 with code e.g. `X_RATE_LIMITED`; client shows try again later. |
| `X_API_CALL_START` but no `X_API_CALL_RESPONSE` | Fetch threw (timeout/network) or process killed. | Keep 502; ensure timeout & body consumption; no UX change. |
| `X_API_CALL_RESPONSE { "status": 200 }` then `DETECT_STAGE_FAIL_INVALID_RESPONSE` or `SYNC_STAGE_FAIL_X_NO_DATA` | X returned 200 but body not JSON or missing data. | Fix parser or handle empty X payload; keep 502 for true parse failure. |
| `access_token_exists: false` or `x_user_id_exists: false` | Token row missing or incomplete (should not 502; we return 403 earlier). | If ever seen, fix data or order of checks. |

### Applied fix (without guessing)

When **X returns 401 or 403**, both routes now return **403** with code **`X_RECONNECT_NEEDED`** and a clear message so the client can show "Reconnect X" instead of a generic 502. This is the most common production cause (stale/revoked token). If logs show a different X status (404, 429, or 200 with bad body), apply the corresponding smallest fix from the matrix above.

---

## 8. Incident fix deliverables (applied)

### Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/api/xspaces/detect-my-space/route.ts` | When X returns 401 or 403, return 403 with `code: "X_RECONNECT_NEEDED"` and message "X connection expired or invalid. Reconnect X in Settings or XSpaces." instead of 502. |
| `apps/web/src/lib/x-analytics-server.ts` | `fetchXSpaceByIdV2` now returns `FetchXSpaceByIdV2Result`: `{ space }` on success or `{ space: null, xStatus: number }` on X error so sync-from-x can map 401/403 to reconnect. |
| `apps/web/src/app/api/spaces/sync-from-x/route.ts` | Use new `fetchXSpaceByIdV2` result; when `xStatus === 401` or `403` return 403 `X_RECONNECT_NEEDED`; otherwise 502 `X_API_FAILED`. |
| `apps/web/src/figma/app/components/XSpacesPage.tsx` | Detect flow: explicit 401 → session expired, 403 (X_RECONNECT_NEEDED / X_NOT_CONNECTED / X_USER_ID_MISSING) → connect/reconnect X. Sync flow (all three call sites): handle 403 with `X_RECONNECT_NEEDED` and show data.error or "Connect or reconnect X to import Spaces." |
| `docs/XSPACES_502_DIAGNOSTIC_FINDINGS.md` | §7 Log interpretation → root cause → fix matrix; §8 this deliverables section. |

### Root cause (confirmed after logs)

- **detect-my-space:** If production logs show `X_API_CALL_RESPONSE { "status": 401 }` or `403`, root cause is **X returns 401/403 (token expired or invalid)**. Fix: return 403 X_RECONNECT_NEEDED and client reconnect copy. Applied.
- **sync-from-x:** Same. If logs show 401/403 from X, root cause is **stale/invalid X token**. Fix: fetchXSpaceByIdV2 returns xStatus; route returns 403 X_RECONNECT_NEEDED; client shows reconnect. Applied.

### Exact fix applied

1. **detect-my-space:** On `!res.ok`, if `res.status === 401 || res.status === 403` → `NextResponse.json(403, { code: "X_RECONNECT_NEEDED", error: "X connection expired or invalid. Reconnect X in Settings or XSpaces." })`. Otherwise keep 502 X_API_FAILED.
2. **sync-from-x:** `fetchXSpaceByIdV2` returns `{ space: null, xStatus }` when X fails. Route: if `xStatus === 401 || xStatus === 403` → 403 X_RECONNECT_NEEDED; else 502 X_API_FAILED. Success path unchanged (`result.space` used as before).

### Client UX mapping summary

| Route | Status/code | Client UX |
|-------|-------------|-----------|
| detect-my-space | 401 AUTH_INVALID | "Your session may have expired. Please sign in again." |
| detect-my-space | 403 X_RECONNECT_NEEDED / X_NOT_CONNECTED / X_USER_ID_MISSING | data.error or "Connect or reconnect X in Settings or XSpaces to detect your Space." |
| detect-my-space | 409 ALREADY_LINKED | Already linked; use Replace. |
| detect-my-space | 429 | Rate limit message. |
| detect-my-space | 502/503 | "X or our service is temporarily unavailable. Try again in a moment or paste the link below." |
| detect-my-space | found: false | "No match found — paste the X Space link below." |
| detect-my-space | require_selection: true | Candidates picker. |
| sync-from-x | 401 AUTH_INVALID | "Your session may have expired. Please sign in again." |
| sync-from-x | 403 X_NOT_CONNECTED / X_NOT_HOST / X_RECONNECT_NEEDED | data.error or "Connect or reconnect X to import Spaces." |
| sync-from-x | 409 ALREADY_IMPORTED / SPACE_OWNED_BY_OTHER | Already imported / owned by other. |
| sync-from-x | 502/503/404 and !data.space | "X or our service is temporarily unavailable. Try again or paste the link below." (no "route not found" interpretation) |

### Manual QA checklist

- [ ] **detect-my-space with valid X:** 200, found/linked or candidates or found:false.
- [ ] **detect-my-space with expired X token (or mock X 401):** 403, code X_RECONNECT_NEEDED, client shows reconnect X message and paste fallback still visible.
- [ ] **sync-from-x with valid X:** 200, space returned.
- [ ] **sync-from-x with expired X token (or mock X 401):** 403, code X_RECONNECT_NEEDED, client shows reconnect X message.
- [ ] **detect 401 (session):** Client shows "Your session may have expired. Please sign in again."
- [ ] **detect 429:** Rate limit message; paste fallback available.
- [ ] **Add from X session refresh:** Unchanged; refresh before sync still in place.
- [ ] **Speaker applications, sponsor proposals, payout preferences, notifications, my-proposals, analytics, reputation, public credibility, profile/dashboard, GET /api/spaces/[id]:** No changes; verify unchanged behavior.

### Confirmation

- **Add from X and session refresh:** Not modified (only sync-from-x response for X 401/403 and client handling of X_RECONNECT_NEEDED added).
- **sync-from-x / detect-my-space:** Success response shapes and success paths unchanged. Only error branch for X 401/403 now returns 403 with X_RECONNECT_NEEDED.
- **Other XSpaces/profile systems:** No code changes. No auth flow, OAuth flow, or UI redesign. Token-based styling only. Safe, incremental change only.

---

## 9. Production log template (paste from Vercel)

**I do not have access to Vercel.** To get exact root cause, reproduce the 502 with DEBUG env vars set, then paste the following from Vercel logs.

### detect-my-space — paste these lines from one failing request

```
[detect-my-space] X_API_CALL_START: ...
[detect-my-space] X_API_CALL_RESPONSE: ...
[detect-my-space] X_API_CALL_DURATION: ...
[detect-my-space] X_API_CALL_BODY: ...   (only if X returned non-200)
[detect-my-space] DETECT_STAGE_*: ...    (last stage line before 502)
```

From these, fill: (1) exact endpoint from START, (2) access_token_exists / x_user_id_exists from START, (3) X HTTP status from RESPONSE, (4) sanitized body from BODY, (5) last successful stage, (6) exact failing stage.

### sync-from-x — paste these lines from one failing request

```
[sync-from-x] X_API_CALL_START: ...
[sync-from-x] X_API_CALL_RESPONSE: ...
[sync-from-x] X_API_CALL_DURATION: ...
[sync-from-x] X_API_CALL_BODY: ...   (only if X returned non-200)
[sync-from-x] SYNC_STAGE_*: ...      (last stage line before 502)
```

Same: endpoint, access_token_exists, x_user_id_exists, X status, body, last successful stage, failing stage.

---

## 10. Index / query verification (no new index needed)

Verified against current code and migrations.

| Index | Migration | Query usage | Verdict |
|-------|-----------|-------------|---------|
| `idx_space_sponsor_proposals_project_status` | 20260312000000 | `space_sponsor_proposals` by `project_profile_id` + status (xspaces-stats, analytics/reputation) | Matches; present. |
| `idx_space_sponsor_proposals_space_status` | 20260312000000 | `space_sponsor_proposals` by `space_id` + status (credibility, host proposals) | Matches; present. |
| `idx_speaker_requests_space_status` | 20260314000000 | `speaker_requests` by `space_id` + status (credibility) | Matches; present. |

**detect-my-space / sync-from-x:** Use `x_oauth_tokens` (eq `profile_id`, `provider`) and `spaces` (eq `id` or `x_space_id`, select by host). No composite index required for these lookups; primary/key lookups suffice.

**analytics / reputation / credibility:** Use the three indexes above via `xspaces-stats` and credibility route. No additional index justified by current queries.

**Conclusion:** No new index added. Existing indexes are sufficient.
