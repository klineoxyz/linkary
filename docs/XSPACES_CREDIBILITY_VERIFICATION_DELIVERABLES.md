# XSpaces Credibility — Verification + Polish Deliverables

## 1. Files changed

| File | Change |
|------|--------|
| `docs/XSPACES_CREDIBILITY_VERIFICATION_PLAN.md` | **New.** Verification plan, already-implemented vs verification-only, public UI decision (document only), index verification plan, risks. |
| `docs/XSPACES_CREDIBILITY_VERIFICATION_DELIVERABLES.md` | **New.** This file. |
| `apps/web/src/figma/app/components/XSpacesPage.tsx` | Minimal detect UX polish: when detect-my-space returns 502 or 503, show "X or our service is temporarily unavailable. Try again in a moment or paste the link below."; for other !res.ok still use sanitized error or fallback copy. No flow or auth changes. |

**Not changed:** detect-my-space route, rate-limit, analytics route, reputation route, xspaces-stats, public credibility endpoint, Add from X, profile/dashboard, sponsor/speaker flows, notifications, payout, visibility.

---

## 2. Verification summary

**Part 1 — Architecture (code audit)**

- **Detect my Space:** 502 hardening confirmed: rate-limit fallback in `rate-limit.ts` is wrapped in try/catch and returns `unavailable` on throw; detect route outer catch uses try/catch around `sanitizeServerError(err)`; `recent` and `scored` use defensive filters so malformed X API data cannot throw. Status codes: 401, 403, 429, 502, 409, 200 as intended. No raw token/auth/cookie logging; `debugDetect` is env-gated and only logs code + sanitized detail.
- **Shared stats:** Analytics route imports `getXSpacesAnalytics` from `@/lib/xspaces-stats` and calls it with supabase + user.id; reputation route imports `getXSpacesAnalytics` and `getApprovedSpeakersTotal` and uses both; no `fetch` to /api/xspaces/analytics or any other endpoint. Formulas and response shapes unchanged.
- **Public credibility:** GET /api/profiles/[id]/xspaces-credibility returns only `hosted_spaces_total`, `approved_speakers_total`, `sponsor_proposals_accepted`. No wallet, proposal values, rates, messages, pitches, deliverables, or pending/declined counts. Safe for public use.
- **Existing product:** Add from X flow and session refresh logic not touched; sponsor proposal/create/accept/decline and payout not touched; profile/dashboard real-data behavior not touched.

**Part 2 — Indexes**

- **Verified present and correct:**  
  - `idx_space_sponsor_proposals_project_status` ON public.space_sponsor_proposals (project_profile_id, status) — 20260312000000  
  - `idx_space_sponsor_proposals_space_status` ON public.space_sponsor_proposals (space_id, status) — 20260312000000  
  - `idx_speaker_requests_space_status` ON public.speaker_requests (space_id, status) — 20260314000000  
- No missing or incorrect index found; no new migration added. No speculative index added.

---

## 3. Any bugs found and fixed

- **None.** Verification did not uncover regressions or bugs. The only code change was optional **detect flow UX polish**: when the detect-my-space API returns 502 or 503, the client now shows a clearer, safe message ("X or our service is temporarily unavailable. Try again in a moment or paste the link below.") instead of the generic "Something went wrong. You can retry or paste the link below." Other non-ok responses still use sanitized error or the same fallback.

---

## 4. Any indexes added or confirmed

- **Added:** None.
- **Confirmed:** All three indexes above exist in migrations and match current query patterns (analytics/reputation/credibility use space_id IN (...) and status = 'accepted' or 'approved').

---

## 5. Public-safe fields exposed

- **Endpoint:** GET /api/profiles/[id]/xspaces-credibility (unchanged).
- **Fields:** `hosted_spaces_total`, `approved_speakers_total`, `sponsor_proposals_accepted` only. No rates, wallet, offer values, messages, pitches, deliverables, or pending/declined counts.

---

## 6. UI summary

- **Public credibility UI:** Not implemented. Decision: **document only.**  
- **Reason:** PublicProfilePage uses demo data and passes the viewer’s `profileId` (for wallets), not the viewed profile’s id. The credibility API requires the **owner** profile id. Adding a block would require owner id in the profile flow and could touch profile contracts.  
- **Next-safe placement (documented in plan):** When the public profile has the viewed profile’s id (e.g. from /api/public/profile or route params), add a small block in UnifiedProfileLayout (or the same section that renders that profile) that fetches GET /api/profiles/{ownerId}/xspaces-credibility and displays: Hosted X Spaces, Approved Speakers Hosted, Sponsor Proposals Accepted. Use existing card/badge styling; no charts or fake data.

---

## 7. Manual QA checklist

- [ ] **Detect my Space:** Valid token + x_oauth_tokens + space_id → 200 (found/linked or candidates or found:false). Invalid session → 401. No token row → 403. Rate limit → 429. Simulated 502/503 (if testable) → user sees "X or our service is temporarily unavailable. Try again in a moment or paste the link below."
- [ ] **Analytics:** GET /api/xspaces/analytics with valid auth → 200; shape unchanged (host, speaker, project, accepted_sponsorship_volume).
- [ ] **Reputation:** GET /api/xspaces/reputation with valid auth → 200; shape unchanged; includes approved_speakers_total.
- [ ] **Public credibility:** GET /api/profiles/[id]/xspaces-credibility (no auth) → 200; only the three aggregates; no sensitive data.
- [ ] **Add from X:** Flow and session refresh behavior unchanged.
- [ ] **Profile/dashboard:** Real-data loading and display unchanged.
- [ ] **Sponsor workflow:** Proposals, inbox, My proposals, accept/decline unchanged.

---

## 8. Confirmation

- **Detect-my-space:** Hardening and behavior unchanged; only client-side error copy improved for 502/503.
- **Add from X:** Not modified; session refresh fix and flow preserved.
- **Analytics endpoint:** Not modified; still uses getXSpacesAnalytics from xspaces-stats.
- **Reputation endpoint:** Not modified; still uses getXSpacesAnalytics + getApprovedSpeakersTotal.
- **Profile/dashboard:** Not modified; real-data behavior preserved.
- **Public credibility endpoint:** Not modified; still returns only the three public-safe aggregates.
