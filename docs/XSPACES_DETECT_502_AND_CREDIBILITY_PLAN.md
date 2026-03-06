# Detect-my-space 502 Fix + Shared Stats + Public Credibility — Plan

## 1. Short implementation plan

| Part | Action |
|------|--------|
| **Part 1** | Audit and harden POST /api/xspaces/detect-my-space: wrap handler in try/catch; add fetch timeout; safe JSON parse for X API response; ensure spaces array is always Array; return deterministic status codes (401/403/429/400/404/200/409/502) with structured codes (X_NOT_CONNECTED, X_USER_ID_MISSING, X_API_FAILED, X_API_TIMEOUT, DETECT_INVALID_RESPONSE, DETECT_INTERNAL_ERROR); optional debug logging when DEBUG_DETECT_MY_SPACE=1; never log tokens. |
| **Part 2** | Add apps/web/src/lib/xspaces-stats.ts: getXSpacesAnalytics(supabase, uid) returning same shape as current analytics; getApprovedSpeakersTotal(supabase, uid) for host. Analytics route uses getXSpacesAnalytics only; reputation route uses both, no internal fetch to analytics. |
| **Part 3** | New GET /api/profiles/[id]/xspaces-credibility (no auth): return only hosted_spaces_total, approved_speakers_total, sponsor_proposals_accepted for that profile_id. Verify/add indexes (sponsor indexes already in migration; add speaker_requests(space_id, status) only if query plan justifies). |
| **Part 4** | If public profile page exists and has clear placement: add tiny credibility block. Otherwise document next-safe step only. |
| **Part 5** | No changes to Add from X, auth, OAuth, sponsor/speaker flows, payout, notifications, visibility; loaders abortable; errors sanitized. |

---

## 2. Detect-my-space 502 root-cause audit plan

- **Likely causes:** (1) X API fetch throws (network/timeout/DNS) → unhandled exception → 502. (2) res.json() throws when X returns non-JSON (HTML/empty) → 502. (3) data.data not an array → spaces.filter() throws. (4) rateLimitXSpacesDetect or Supabase RPC throws. (5) Missing env (e.g. supabaseUrl) causing createClient to throw.
- **Inspection:** detect-my-space/route.ts (full), rate-limit.ts (Upstash/Supabase fallback), x_oauth_tokens read path, X API URL and response handling.
- **Fixes:** Top-level try/catch returning safe 502 with code; try/catch around fetch + timeout (AbortController); safe parse of res.json(); spaces = Array.isArray(data?.data) ? data.data : []; guard tokenRow and x_user_id with explicit 403 codes; validate body.space_id when used.

---

## 3. Shared-helper refactor plan

- **New file:** apps/web/src/lib/xspaces-stats.ts.
- **Exports:** getXSpacesAnalytics(supabase, uid): Promise<AnalyticsShape> (host, speaker, project, accepted_sponsorship_volume). getApprovedSpeakersTotal(supabase, uid): Promise<number> (count approved speaker_requests on spaces where host_profile_id = uid).
- **Analytics route:** Auth + createClient as now; call getXSpacesAnalytics(supabase, user.id); return JSON. No other logic change.
- **Reputation route:** Auth + createClient; call getXSpacesAnalytics + getApprovedSpeakersTotal; build reputation shape from analytics + approved_speakers_total; return JSON. Remove internal fetch to /api/xspaces/analytics.

---

## 4. Public-safe credibility exposure decision

- **Choice:** New read-only endpoint GET /api/profiles/[id]/xspaces-credibility (no auth required).
- **Fields:** hosted_spaces_total, approved_speakers_total, sponsor_proposals_accepted only.
- **Implementation:** Single route; by profile id (host_profile_id) query spaces count, then space_sponsor_proposals (accepted) and speaker_requests (approved) on those space ids. No rates, no wallet, no messages/pitches/deliverables.
- **Indexes:** 20260312000000 already has space_sponsor_proposals indexes. Add speaker_requests(space_id, status) in a new migration only if we confirm the credibility query uses it (it will: we filter by space_id IN (...) and status = 'approved').

---

## 5. Risks / compatibility notes

| Risk | Mitigation |
|------|------------|
| Detect: fetch timeout too short | Use 15s; on timeout return 502 X_API_TIMEOUT. |
| Detect: rate limit throws | Top-level try/catch returns 502 DETECT_INTERNAL_ERROR with safe message. |
| Shared helper changes formulas | Copy exact logic from current analytics route; no formula change. |
| Reputation response shape | Build from helper output; shape unchanged. |
| Public credibility exposes private data | Expose only the three agreed aggregates; no PII. |
| Profile [id] not found | Return 200 with zeros or 404; prefer 200 with zeros for consistency. |

Add from X, sync-from-x, analytics, reputation, profile/dashboard, sponsor workflow: no behavior changes.

---

## 6. Detect-my-space regression checklist

- [ ] **Connected user with token row:** Valid Bearer + x_oauth_tokens row with access_token and x_user_id → 200 with found/linked or candidates or found:false.
- [ ] **Connected user missing x_user_id:** Token row present, x_user_id null → 403, code X_USER_ID_MISSING.
- [ ] **No x_oauth_tokens row:** → 403, code X_NOT_CONNECTED.
- [ ] **No candidate found:** X returns spaces but none match title/time → 200, found: false.
- [ ] **Multiple candidates:** Several match → 200, require_selection: true, candidates array.
- [ ] **Upstream X API failure:** X returns 5xx or non-JSON → 502, code X_API_FAILED or DETECT_INVALID_RESPONSE.
- [ ] **Invalid session:** Expired or invalid token → 401.
- [ ] **Rate limit exceeded:** >10 req/min → 429, code RATE_LIMITED.

## 7. 502 hardening applied (implementation)

- **Rate-limit fallback:** When Upstash fails and we fall back to Supabase `rateLimit()`, the fallback is now wrapped in try/catch; on throw we return `{ unavailable: true }` so the route returns 503 instead of an unhandled exception (502).
- **Outer catch:** The route’s catch block no longer calls `sanitizeServerError(err)` directly; it wraps it in try/catch so a bad error object cannot cause a second throw and a generic Vercel 502.
- **X API response:** `recent` is built with a defensive filter so null/non-object or missing `created_at` entries do not throw. `scored` is built only from items that have a string `id`, so malformed X API items cannot cause a throw in the candidates map.
