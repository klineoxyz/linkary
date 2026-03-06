# Detect-my-space 502 Fix + Credibility — Deliverables

## 1. Files changed

| File | Change |
|------|--------|
| `apps/web/src/lib/rate-limit.ts` | Upstash catch block: fallback to Supabase `rateLimit()` is now wrapped in try/catch; on throw returns `{ unavailable: true }` so route returns 503 instead of unhandled 502. |
| `apps/web/src/app/api/xspaces/detect-my-space/route.ts` | Outer catch uses try/catch around `sanitizeServerError(err)` so a bad error object cannot rethrow. Defensive filter for `recent` (null/non-object/missing created_at). `scored` built only from items with string `id` to avoid throws on malformed X API items. |
| `docs/XSPACES_DETECT_502_AND_CREDIBILITY_PLAN.md` | Added §7 documenting 502 hardening applied. |
| `docs/XSPACES_DETECT_502_AND_CREDIBILITY_DELIVERABLES.md` | **New.** This file. |

**Not changed:** Add from X, sync-from-x, Connect X, analytics route, reputation route, payout, notifications, profile/dashboard real-data, GET /api/spaces/[id], auth, OAuth. Existing `xspaces-stats.ts`, analytics route, reputation route, and GET /api/profiles/[id]/xspaces-credibility were already in place.

---

## 2. Detect-my-space fix summary

- **Rate limit:** When Upstash is used and the Upstash request fails, the code falls back to Supabase `consume_rate_limit` RPC. That fallback is now inside a try/catch; if the RPC or Supabase client throws, the handler returns `{ unavailable: true }` and the route responds with **503** (rate limit service unavailable) instead of an unhandled exception that would surface as **502**.
- **Route catch:** The route’s top-level catch no longer assumes `sanitizeServerError(err)` never throws. It wraps that call in try/catch and uses a fixed message if sanitization throws, then returns **502** with code `DETECT_INTERNAL_ERROR`.
- **X API response:** The array from the X API is filtered defensively for `recent` (only objects with string `created_at` in the time window). The `scored` list is built only from items that have a string `id`, so malformed or partial objects cannot cause a throw when building `candidates`.

---

## 3. Exact 502 root cause(s) found

- **Most likely:** Unhandled exception in the **rate-limit fallback path**. When Upstash is configured but fails (e.g. network, timeout, or non-JSON response), the code falls back to Supabase `rateLimit()`. If that call throws (e.g. Supabase connection error, missing RPC, or transient failure), the exception was not caught and propagated to Vercel, resulting in **502 Bad Gateway**.
- **Secondary:** A malformed **error object** in the route’s catch block could theoretically cause `sanitizeServerError(err)` to throw (e.g. exotic getters), leading to a second unhandled exception and **502**.
- **Theoretical:** Malformed or partial items in the X API **spaces array** (e.g. missing `id` or `created_at`) could cause a throw in the filter/map chain; the new guards make that path safe.

---

## 4. Routes added/changed

- **No new routes added** in this change.
- **Unchanged:** POST /api/xspaces/detect-my-space (behavior and response shapes unchanged; only hardened). GET /api/xspaces/analytics, GET /api/xspaces/reputation, GET /api/profiles/[id]/xspaces-credibility already existed and were not modified.

---

## 5. Refactor summary

- **Shared stats:** Already present. `apps/web/src/lib/xspaces-stats.ts` exports `getXSpacesAnalytics` and `getApprovedSpeakersTotal`. GET /api/xspaces/analytics and GET /api/xspaces/reputation use this helper directly; there is no endpoint-to-endpoint internal fetch.
- **Formulas and response shapes:** Unchanged; no refactor of analytics or reputation logic in this pass.

---

## 6. Any indexes added

- **None in this change.** Existing migrations already provide:
  - `idx_space_sponsor_proposals_project_status`, `idx_space_sponsor_proposals_space_status` (20260312000000)
  - `idx_speaker_requests_space_status` (20260314000000)

---

## 7. Public-safe fields exposed

- **Existing:** GET /api/profiles/[id]/xspaces-credibility (no auth) returns:
  - `hosted_spaces_total`
  - `approved_speakers_total`
  - `sponsor_proposals_accepted`
- No rates, wallet, messages, pitches, deliverables, or other private data. No changes made to this endpoint in this pass.

---

## 8. UI summary

- **No UI changes** in this pass. Part 4 (minimal credibility UI) was not implemented; the plan recommends adding a small optional credibility block on the correct profile/public surface only when it fits the existing product structure. No forced UI changes.

---

## 9. Manual QA checklist

**Detect-my-space**

- [ ] Valid Bearer + x_oauth_tokens row with access_token and x_user_id → 200 (found/linked or candidates or found:false).
- [ ] Token row present, x_user_id null → 403, code X_USER_ID_MISSING.
- [ ] No x_oauth_tokens row → 403, code X_NOT_CONNECTED.
- [ ] No candidate found (X returns spaces, none match) → 200, found: false.
- [ ] Multiple candidates match → 200, require_selection: true, candidates array.
- [ ] X API 5xx or non-JSON → 502, code X_API_FAILED or DETECT_INVALID_RESPONSE.
- [ ] Invalid/expired token → 401.
- [ ] Rate limit exceeded → 429, code RATE_LIMITED.
- [ ] Upstash down and Supabase fallback throws (if reproducible) → 503 (rate limit unavailable), not 502.

**Analytics / reputation / credibility**

- [ ] GET /api/xspaces/analytics with valid auth → 200; shape unchanged.
- [ ] GET /api/xspaces/reputation with valid auth → 200; shape unchanged; includes approved_speakers_total.
- [ ] GET /api/profiles/[id]/xspaces-credibility (no auth) → 200; only hosted_spaces_total, approved_speakers_total, sponsor_proposals_accepted.

**Safety**

- [ ] Add from X flow (including session refresh fix) works as before.
- [ ] Profile/dashboard real-data behavior unchanged.
- [ ] Sponsor proposal workflow (create, accept/decline, inbox, My proposals) unchanged.
- [ ] No token or auth header logged; errors sanitized.

---

## 10. Confirmation

- **Add from X fix:** Not modified; session refresh and sync-from-x behavior preserved.
- **Analytics endpoint:** Not modified; still uses `getXSpacesAnalytics` from `xspaces-stats`.
- **Reputation endpoint:** Not modified; still uses `getXSpacesAnalytics` + `getApprovedSpeakersTotal`; no internal fetch to analytics.
- **Profile/dashboard real-data:** Not modified; no changes to App.tsx or profile data loading.
- **Sponsor workflow, payout, notifications, GET /api/spaces/[id] visibility:** Not modified.
