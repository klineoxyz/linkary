# Detect-my-space 502 — Final Production-Debug Plan

## 1. Which exact stage markers to check first

With **DEBUG_DETECT_MY_SPACE=1** set in Vercel env, reproduce a failing request and inspect logs. Check in this order:

| Order | Marker | Meaning |
|-------|--------|--------|
| 1 | `DETECT_STAGE_AUTH_OK` | Auth passed; next failure is rate limit, body, token row, or X API. |
| 2 | `DETECT_STAGE_TOKEN_ROW_FOUND` | Token row exists; next failure is X API fetch or response. |
| 3 | `DETECT_STAGE_X_API_RESPONSE` (items=N) | X API returned JSON; next failure is candidate build or auto-link. |
| 4 | `DETECT_STAGE_CANDIDATES_BUILT` (N) | Candidates built; next failure is auto-link/update or final response. |

**If 502 and no marker after AUTH_OK:** failure is in rate limit, body parse, or token lookup.  
**If last marker is TOKEN_ROW_FOUND:** failure is X API fetch (timeout, non-200, or throw).  
**If last marker is DETECT_STAGE_FAIL_X_API:** X returned non-200.  
**If last marker is X_API_TIMEOUT or X_API_FAILED (in catch):** fetch threw (timeout or network).  
**If last marker is DETECT_STAGE_FAIL_INVALID_RESPONSE:** X body was not valid JSON.  
**If last marker is DETECT_STAGE_X_API_RESPONSE:** failure is in recent/scored/candidates or Supabase (linkary space fetch / update).  
**If last marker is DETECT_STAGE_CANDIDATES_BUILT:** failure is in single-candidate auto-link (Supabase update) or in returning response.  
**If you see DETECT_INTERNAL_ERROR:** something threw in the main try; the detail is sanitized.

The **last** marker logged before the 502 response (or before the request ends) is the failing stage.

---

## 2. Top 3 most likely remaining 502 sources

1. **X API fetch timeout / Vercel kill**  
   Our timeout is 15s. If the platform limit is 10s (e.g. some plans), the function can be killed before our AbortController fires, producing a generic 502/504. **Fix:** Lower X_API_TIMEOUT_MS to 8s so our timeout always runs before a 10s platform limit.

2. **X API returns non-200 (e.g. 401/403/429)**  
   We return 502 with X_API_FAILED and log DETECT_STAGE_FAIL_X_API. No code change needed; confirm in logs. If we don’t consume the error body, some runtimes can misbehave. **Fix:** Consume response body when !res.ok (e.g. await res.text().catch(() => '')) so the connection is closed cleanly.

3. **X API returns non-JSON or empty body**  
   res.json() throws → we catch and return DETECT_INVALID_RESPONSE. Already handled. Optional: when !res.ok, consume body before returning so we don’t try to parse it later (we already return before res.json() when !res.ok).

---

## 3. Minimal-fix plan only

- **Change 1:** Set `X_API_TIMEOUT_MS = 8000` so our timeout fires before a 10s Vercel limit and we return 502 with code X_API_TIMEOUT instead of the function being killed.
- **Change 2:** When `!res.ok`, consume the response body with `await res.text().catch(() => '')` so the response stream is fully read and the connection is closed; then return 502 X_API_FAILED as today. No change to response shape or codes.
- **No** broad hardening, no new stages, no change to Add from X, sync-from-x, or client UX.
