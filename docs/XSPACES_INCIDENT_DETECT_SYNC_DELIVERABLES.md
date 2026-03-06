# XSpaces Incident: detect-my-space 502 + sync-from-x 404 — Deliverables

## 1. Exact files changed

| File | Change |
|------|--------|
| `docs/XSPACES_INCIDENT_DETECT_SYNC_PLAN.md` | **New.** Investigation plan, root causes, logging plan, error-code plan, route audit, risks. |
| `docs/XSPACES_INCIDENT_DETECT_SYNC_DELIVERABLES.md` | **New.** This file. |
| `apps/web/src/lib/server-error.ts` | Added `debugSync(code, detail?)` gated by `DEBUG_SYNC_FROM_X=1`. |
| `apps/web/src/app/api/spaces/sync-from-x/route.ts` | Top-level try/catch; 401/403/400/409/502 with deterministic codes (AUTH_INVALID, X_NOT_CONNECTED, SYNC_INVALID_INPUT, MISSING_INPUT, INVALID_URL, ALREADY_IMPORTED, SPACE_OWNED_BY_OTHER, X_NOT_HOST, X_API_FAILED, SYNC_INTERNAL_ERROR); 404→502 when v2Space is null; try/catch around fetchXSpaceByIdV2; insert error→502 SYNC_INTERNAL_ERROR; structured debug (SYNC_STAGE_*). |
| `apps/web/src/app/api/xspaces/detect-my-space/route.ts` | 401/503 with codes AUTH_INVALID, RATE_LIMIT_UNAVAILABLE; structured debug (DETECT_STAGE_AUTH_OK, DETECT_STAGE_TOKEN_ROW_FOUND, DETECT_STAGE_X_API_RESPONSE, DETECT_STAGE_CANDIDATES_BUILT, DETECT_STAGE_FAIL_*). |
| `apps/web/src/figma/app/components/XSpacesPage.tsx` | Sync-from-x: 401→session expired; 403 X_NOT_CONNECTED/X_NOT_HOST→connect X; 502/503/404 (no space)→temporarily unavailable + paste link; same logic in all three sync call sites (Add from X, Import from list, Link pasted URL). |

**Not changed:** Add from X session refresh, sync-from-x business logic (create/update space, participant sync), detect flow logic, speaker/sponsor/payout/notifications/my-proposals, analytics/reputation/credibility, profile/dashboard, visibility, auth/OAuth.

---

## 2. Exact detect-my-space 502 root cause found

- **No single new bug identified in this pass.** The route was already hardened (rate-limit fallback try/catch, outer catch with safe sanitizeServerError, defensive recent/scored/safeScored).
- **Possible remaining 502 sources in production:** (1) Supabase `getUser` or client throw in an edge case; (2) an unhandled throw in a code path we didn’t cover; (3) Vercel/runtime killing the function (e.g. timeout). The outer catch returns 502 with DETECT_INTERNAL_ERROR for any thrown error.
- **What was done:** Added structured debug at each stage (DETECT_STAGE_AUTH_OK, DETECT_STAGE_TOKEN_ROW_FOUND, DETECT_STAGE_X_API_RESPONSE, DETECT_STAGE_CANDIDATES_BUILT, DETECT_STAGE_FAIL_*) so that with **DEBUG_DETECT_MY_SPACE=1** one Vercel log session shows the exact stage where the request failed. All failure branches now return deterministic codes (AUTH_INVALID, X_NOT_CONNECTED, X_USER_ID_MISSING, RATE_LIMIT_UNAVAILABLE, X_API_FAILED, DETECT_INVALID_RESPONSE, DETECT_INTERNAL_ERROR).

---

## 3. Exact sync-from-x 404 root cause found

- **Root cause:** The route **exists** at `apps/web/src/app/api/spaces/sync-from-x/route.ts`. The client correctly calls `POST /api/spaces/sync-from-x`. The **handler** was returning **404** when `fetchXSpaceByIdV2(spaceId, accessToken)` returned **null** (X API failure or space not found). That 404 was interpreted as “route not found” in production.
- **Fix:** When `v2Space` is null, the handler now returns **502** with code **X_API_FAILED** and message “Could not fetch Space from X. Try again.” No route or path change. `fetchXSpaceByIdV2` is wrapped in try/catch so upstream throw also returns 502 X_API_FAILED. Insert failure returns 502 SYNC_INTERNAL_ERROR instead of 500. Top-level try/catch returns 502 SYNC_INTERNAL_ERROR for any unhandled throw.

---

## 4. What was hardened

**sync-from-x**

- Entire POST wrapped in try/catch; catch returns 502 SYNC_INTERNAL_ERROR with sanitized message.
- 401 → AUTH_INVALID; 403 → X_NOT_CONNECTED / X_NOT_HOST; 400 → SYNC_INVALID_INPUT | MISSING_INPUT | INVALID_URL; 409 → ALREADY_IMPORTED | SPACE_OWNED_BY_OTHER; 502 → X_API_FAILED | SYNC_INTERNAL_ERROR.
- X fetch: try/catch around fetchXSpaceByIdV2; null result → 502 X_API_FAILED (no longer 404).
- DB: token lookup error and missing access_token/x_user_id → 403 X_NOT_CONNECTED; insert error → 502 SYNC_INTERNAL_ERROR.
- Structured debug: SYNC_STAGE_ROUTE_HIT, SYNC_STAGE_AUTH_OK, SYNC_STAGE_BODY_OK, SYNC_STAGE_TOKEN_ROW_FOUND, SYNC_STAGE_X_FETCH_OK, SYNC_STAGE_INSERT_OK, SYNC_STAGE_ALREADY_IMPORTED, SYNC_STAGE_FAIL_*.

**detect-my-space**

- 401 → AUTH_INVALID; 503 → RATE_LIMIT_UNAVAILABLE with code.
- Structured debug: DETECT_STAGE_AUTH_OK, DETECT_STAGE_TOKEN_ROW_FOUND, DETECT_STAGE_X_API_RESPONSE (with item count), DETECT_STAGE_CANDIDATES_BUILT, DETECT_STAGE_FAIL_* for each failure branch.

**Client**

- All three sync-from-x call sites: 401 → “Your session may have expired. Please sign in again.”; 403 (X_NOT_CONNECTED/X_NOT_HOST) → connect-X message; 502/503/404 (and no data.space) → “X or our service is temporarily unavailable. Try again [or paste the link below].” Paste-link fallback remains reachable when sync or detect fails.

---

## 5. Structured debug markers added

**detect-my-space (DEBUG_DETECT_MY_SPACE=1)**

- DETECT_STAGE_AUTH_OK (with user id)
- DETECT_STAGE_TOKEN_ROW_FOUND
- DETECT_STAGE_X_API_RESPONSE (items count or “no array”)
- DETECT_STAGE_CANDIDATES_BUILT (candidates.length)
- DETECT_STAGE_FAIL_AUTH, DETECT_STAGE_FAIL_TOKEN_LOOKUP, DETECT_STAGE_FAIL_X_NOT_CONNECTED, DETECT_STAGE_FAIL_X_API (status), DETECT_STAGE_FAIL_INVALID_RESPONSE, DETECT_STAGE_FAIL_RATE_LIMIT_UNAVAILABLE, DETECT_INTERNAL_ERROR (existing)

**sync-from-x (DEBUG_SYNC_FROM_X=1)**

- SYNC_STAGE_ROUTE_HIT
- SYNC_STAGE_AUTH_OK (user id)
- SYNC_STAGE_BODY_OK
- SYNC_STAGE_TOKEN_ROW_FOUND
- SYNC_STAGE_X_FETCH_OK
- SYNC_STAGE_INSERT_OK (space id)
- SYNC_STAGE_ALREADY_IMPORTED
- SYNC_STAGE_FAIL_AUTH, SYNC_STAGE_FAIL_TOKEN_LOOKUP, SYNC_STAGE_FAIL_X_NOT_CONNECTED, SYNC_STAGE_FAIL_X_FETCH, SYNC_STAGE_FAIL_X_NO_DATA, SYNC_STAGE_FAIL_INSERT, SYNC_STAGE_FAIL_INTERNAL

No access_token, refresh_token, Authorization header, cookies, or raw secrets are logged.

---

## 6. Deterministic error codes added/confirmed

**detect-my-space**

- 401 AUTH_INVALID
- 403 X_NOT_CONNECTED, X_USER_ID_MISSING
- 429 RATE_LIMITED
- 409 ALREADY_LINKED
- 502 X_API_TIMEOUT, X_API_FAILED, DETECT_INVALID_RESPONSE, DETECT_INTERNAL_ERROR
- 503 RATE_LIMIT_UNAVAILABLE

**sync-from-x**

- 401 AUTH_INVALID
- 403 X_NOT_CONNECTED, X_NOT_HOST
- 400 SYNC_INVALID_INPUT, MISSING_INPUT, INVALID_URL
- 409 ALREADY_IMPORTED, SPACE_OWNED_BY_OTHER
- 502 X_API_FAILED, SYNC_INTERNAL_ERROR

---

## 7. Client UX mapping summary

**detect-my-space (unchanged behavior, already had 502/503 copy)**

- 401 → session expired (existing)
- 403 X_NOT_CONNECTED / X_USER_ID_MISSING → connect X (existing)
- 429 → rate limit copy (existing)
- 409 → already linked (existing)
- 502/503 → “X or our service is temporarily unavailable. Try again in a moment or paste the link below.” (existing)
- found:false → no match + paste link (existing)
- require_selection:true → candidates picker (existing)

**sync-from-x (updated)**

- 401 / AUTH_INVALID → “Your session may have expired. Please sign in again.”
- 403 / X_NOT_CONNECTED or X_NOT_HOST → “Connect X first to import Spaces.” (or “Connect X first to link.” for paste-link flow)
- 409 ALREADY_IMPORTED → “Already imported.” (existing)
- 502 / 503 / 404 (and no space) → “X or our service is temporarily unavailable. Try again [or paste the link below].”
- Other → sanitized error from API.

Paste-link fallback remains available when detect or sync fails.

---

## 8. Index verification

- **Checked:** idx_space_sponsor_proposals_project_status, idx_space_sponsor_proposals_space_status, idx_speaker_requests_space_status (all present in migrations 20260312000000, 20260314000000).
- **Conclusion:** No new index added. Existing indexes match current query patterns for analytics, reputation, credibility, my-proposals, and inbox. No speculative index bloat.

---

## 9. Manual QA checklist

- [ ] **detect-my-space:** Valid token + x_oauth_tokens + space_id → 200 (found/linked or candidates or found:false). Invalid session → 401, code AUTH_INVALID. No token row → 403, code X_NOT_CONNECTED. Rate limit exceeded → 429, code RATE_LIMITED. Rate limit unavailable → 503, code RATE_LIMIT_UNAVAILABLE. With DEBUG_DETECT_MY_SPACE=1, logs show stage markers.
- [ ] **sync-from-x:** Valid token + url/space_id → 200 with space. Invalid session → 401, code AUTH_INVALID. No x_oauth_tokens / no access_token or x_user_id → 403, code X_NOT_CONNECTED. X API returns null or throws → 502, code X_API_FAILED (not 404). Insert error → 502, code SYNC_INTERNAL_ERROR. With DEBUG_SYNC_FROM_X=1, logs show stage markers.
- [ ] **Client:** Add from X: 401 → session expired; 403 → connect X; 502/503/404 → temporarily unavailable + paste link; 409 ALREADY_IMPORTED → already imported. Detect: paste-link fallback always reachable; 502/503 → temporary unavailable message.
- [ ] **Add from X:** Session refresh before sync unchanged; success path and overlap fetch unchanged.
- [ ] **Other XSpaces:** Analytics, reputation, credibility, my-proposals, inbox, speaker, sponsor, payout, visibility unchanged.

---

## 10. Confirmation

- **Add from X:** Session refresh and flow preserved. Sync-from-x now returns 502 instead of 404 when X API fails; client shows “temporarily unavailable” and paste-link remains available.
- **detect-my-space:** Behavior unchanged; only added stage debug and deterministic 401/503 codes. No change to success paths or rate-limit logic.
- **sync-from-x:** Business logic (create space, participant sync, ALREADY_IMPORTED, SPACE_OWNED_BY_OTHER) unchanged. Only response status/codes and hardening added.
- **Analytics, reputation, public credibility, profile/dashboard, sponsor/speaker workflows, notifications, payout, GET /api/spaces/[id] visibility:** Not modified.
