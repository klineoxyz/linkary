# XSpaces Incident: detect-my-space 502 + sync-from-x 404 — Investigation & Fix Plan

## 1. Short investigation plan

| Step | Action |
|------|--------|
| 1 | Trace detect-my-space: auth → body → rate limit → x_oauth_tokens → X API fetch → response parse → recent/scored/candidates → auto-link/selection → catch. Identify any remaining throw path. |
| 2 | Trace sync-from-x: confirm route exists at `apps/web/src/app/api/spaces/sync-from-x/route.ts`; confirm client calls `/api/spaces/sync-from-x`; check if 404 is route-not-found or handler-returned 404. |
| 3 | Harden both: wrap handlers in try/catch; deterministic error codes; structured debug (env-gated); no token/header logging. |
| 4 | Fix sync-from-x: handler currently returns **404** when `fetchXSpaceByIdV2` returns null (X API failure). Change to **502** with code X_API_FAILED so production does not confuse with missing route. Wrap X fetch in try/catch. |
| 5 | Client: ensure 401/403/409/502/503 and paste-link fallback are handled for both flows. |
| 6 | Index verification: confirm existing indexes; no speculative add. |

---

## 2. Likely root causes

**detect-my-space 502**

- Possible remaining causes: (a) Supabase `getUser` or client throw in edge cases; (b) rate-limit fallback path (already wrapped); (c) X API response body not JSON (already caught); (d) malformed array item (already guarded); (e) unhandled throw in candidate/auto-link path. Outer try/catch returns 502 DETECT_INTERNAL_ERROR. Fix: add structured debug at each stage so one Vercel log session shows exact failure stage; ensure every branch returns a deterministic code.

**sync-from-x 404**

- **Root cause:** The route **exists** and is correct. The handler returns **404** when `fetchXSpaceByIdV2(spaceId, accessToken)` returns **null** (X API failed or space not found). Clients and ops interpret 404 as "route not found". Fix: return **502** with code **X_API_FAILED** (and safe message) when v2Space is null; wrap `fetchXSpaceByIdV2` in try/catch so upstream throw also becomes 502. No route or path change.

---

## 3. Logging plan

- **detect-my-space:** Use existing `debugDetect(code, detail?)`; add stage markers: DETECT_STAGE_AUTH_OK, DETECT_STAGE_TOKEN_ROW_FOUND, DETECT_STAGE_X_API_RESPONSE, DETECT_STAGE_CANDIDATES_BUILT; on failure DETECT_STAGE_FAIL_* or existing codes. Gate: DEBUG_DETECT_MY_SPACE=1.
- **sync-from-x:** Add `debugSync(code, detail?)` in server-error.ts; gate: DEBUG_SYNC_FROM_X=1. Markers: SYNC_STAGE_ROUTE_HIT, SYNC_STAGE_AUTH_OK, SYNC_STAGE_BODY_OK, SYNC_STAGE_TOKEN_ROW_FOUND, SYNC_STAGE_X_FETCH_OK, SYNC_STAGE_INSERT_OK, SYNC_STAGE_FAIL_*.
- **Never log:** access_token, refresh_token, Authorization header, cookies, raw secrets, full untrusted payloads.
- **May log:** user id (uuid), route hit, whether token row exists, x_user_id exists, X API response status, item counts, error code, sanitized message.

---

## 4. Deterministic error-code plan

**detect-my-space**

- 401 → AUTH_INVALID
- 403 → X_NOT_CONNECTED | X_USER_ID_MISSING
- 429 → RATE_LIMITED
- 409 → ALREADY_LINKED
- 502 → X_API_TIMEOUT | X_API_FAILED | DETECT_INVALID_RESPONSE | DETECT_INTERNAL_ERROR
- 503 → RATE_LIMIT_UNAVAILABLE

**sync-from-x**

- 401 → AUTH_INVALID
- 403 → X_NOT_CONNECTED
- 400 → SYNC_INVALID_INPUT | MISSING_INPUT | INVALID_URL
- 409 → ALREADY_IMPORTED | SPACE_OWNED_BY_OTHER
- 502 → X_API_FAILED | SYNC_INVALID_RESPONSE | SYNC_INTERNAL_ERROR

---

## 5. Route/path audit plan for sync-from-x

- **Exists:** `apps/web/src/app/api/spaces/sync-from-x/route.ts` (POST).
- **Client:** XSpacesPage calls `POST ${base}/api/spaces/sync-from-x` in three places (paste link, Import from list, Add from X button). Path is correct.
- **App Router:** Static segment `sync-from-x` takes precedence over `[id]`; no conflict.
- **Conclusion:** 404 is from handler when v2Space is null; fix by changing that response to 502 + code. No route or client path change.

---

## 6. Risk / compatibility notes

| Risk | Mitigation |
|------|------------|
| Changing 404→502 for sync | Client already handles non-ok generically; add explicit 502/503 copy for "temporarily unavailable". |
| New debug logs | Env-gated; no secrets. |
| Error code additions | Additive; clients that check code can use them; others ignore. |
| Add from X / detect UX | No change to success paths or paste-link fallback. |

Add from X session refresh, sync-from-x business logic, detect flow, and all other XSpaces/profile systems remain unchanged.
