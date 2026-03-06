# Detect-my-space 502 — Final Production-Debug Deliverables

## 1. Exact remaining root cause found

- **Inferred from code (no production logs provided):** The most plausible remaining cause of 502 with valid auth is the **X API request taking longer than the platform execution limit**. Our timeout was **15s**; if the host (e.g. Vercel) kills the function at **10s**, our handler never runs the timeout branch and the user gets a generic 502 instead of a controlled 502 with code `X_API_TIMEOUT`.
- **Secondary:** When X returns non-200, we return 502 without consuming the response body; in some runtimes that can leave the connection or stream in a bad state. Consuming the body when `!res.ok` avoids that.

## 2. Exact stage where it failed

- If the function is killed by the platform before our timeout: **no** stage after `DETECT_STAGE_TOKEN_ROW_FOUND` would be logged; the process would stop during the X API fetch.
- If the failure is X non-200: the last marker would be **DETECT_STAGE_FAIL_X_API** with status code.
- To confirm in production: set **DEBUG_DETECT_MY_SPACE=1**, reproduce, and use the marker sequence in `docs/XSPACES_DETECT_502_FINAL_DEBUG_PLAN.md` to see the last stage before 502.

## 3. Exact files changed

| File | Change |
|------|--------|
| `docs/XSPACES_DETECT_502_FINAL_DEBUG_PLAN.md` | **New.** Stage marker order, top 3 likely 502 sources, minimal-fix plan. |
| `docs/XSPACES_DETECT_502_FINAL_DEBUG_DELIVERABLES.md` | **New.** This file. |
| `apps/web/src/app/api/xspaces/detect-my-space/route.ts` | `X_API_TIMEOUT_MS` reduced from 15000 to **8000**; when `!res.ok`, **consume body** with `await res.text().catch(() => "")` before returning 502. |

**Not changed:** sync-from-x, Add from X, detect response shapes, deterministic codes, client UX, other XSpaces/profile systems.

## 4. Minimal fix applied

- **Timeout:** `X_API_TIMEOUT_MS` set to **8000** so the X API request is aborted after 8s and we return 502 with code `X_API_TIMEOUT` before a typical 10s platform limit. Comment added explaining the choice.
- **Error response body:** When `!res.ok`, we call `await res.text().catch(() => "")` before returning 502 with `X_API_FAILED`, so the response stream is fully read and the connection is closed. No change to status or response body.

## 5. Manual QA checklist

- [ ] **Detect with valid auth + X connected:** Request completes; either 200 (found/linked/candidates) or 200 found:false or 403/429 as before.
- [ ] **Slow X API:** With DEBUG_DETECT_MY_SPACE=1, if X is slow, logs show X_API_TIMEOUT and response is 502 with code X_API_TIMEOUT; client shows temporary unavailable + paste-link.
- [ ] **X returns 401/403/429:** Logs show DETECT_STAGE_FAIL_X_API with status; response 502 X_API_FAILED; client shows temporary unavailable.
- [ ] **401/403/429/409/502/503/client copy:** Unchanged (401 → session expired, 403 → connect X, 429 → rate limit, 409 → already linked, 502/503 → temporary unavailable + paste-link).
- [ ] **Add from X / sync-from-x:** Unchanged; no edits to those flows.
- [ ] **Other XSpaces (analytics, reputation, credibility, my-proposals, speaker, sponsor, payout, visibility):** Unchanged.

## 6. Confirmation

- **Sync-from-x:** Not modified.
- **Add from X:** Not modified; session refresh and sync-from-x behavior unchanged.
- **Other XSpaces/profile systems:** Not modified.
- **Detect-my-space:** Only the two changes above (timeout 15s→8s, consume body when !res.ok); all other behavior and response shapes unchanged.
