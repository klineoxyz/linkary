# XSpaces Reputation Surface + Credibility — Deliverables

## 1. Files changed

| File | Change |
|------|--------|
| `docs/XSPACES_REPUTATION_SURFACE_PLAN.md` | **New.** Implementation plan, formulas, API design, UI placement, risks. |
| `apps/web/src/app/api/xspaces/reputation/route.ts` | **New.** GET /api/xspaces/reputation: auth, internal call to analytics, one query for approved_speakers_total, return reputation shape. |
| `apps/web/src/figma/app/components/xspaces/HomeView.tsx` | Added XSpacesReputation type; optional reputation + reputationLoading props; Analytics tab extended with "Reputation" block (4 cards) below existing analytics cards. |
| `apps/web/src/figma/app/components/xspaces/index.ts` | Export XSpacesReputation. |
| `apps/web/src/figma/app/components/XSpacesPage.tsx` | State for xspacesReputation + xspacesReputationLoading; effect to fetch GET /api/xspaces/reputation when mainNav === "home" and me?.id; pass reputation + reputationLoading to HomeView. |
| `docs/XSPACES_REPUTATION_SURFACE_DELIVERABLES.md` | **New.** This file. |

**Not changed:** Add from X, analytics route, profile/dashboard real-data, sponsor workflow, payout, notifications, GET /api/spaces/[id], auth, OAuth, token handling.

---

## 2. Routes added/changed

- **Added:** **GET /api/xspaces/reputation**
  - Auth required (Bearer). 401 if missing/invalid.
  - Reuses data via internal server-side fetch to GET /api/xspaces/analytics (same token).
  - One extra read-only query: count of approved speaker_requests on spaces hosted by current user.
  - Response: speaker (applications_total, approved_total, declined_total, withdrawn_total, approval_rate), sponsor (proposals_total, accepted_total, declined_total, pending_total, acceptance_rate), host (hosted_spaces_total, sponsor_proposals_received, sponsor_proposals_accepted, sponsor_proposals_declined, sponsor_acceptance_rate, approved_speakers_total).
- **Unchanged:** GET /api/xspaces/analytics (no code or behavior changes).

---

## 3. Reputation formulas used

- **Speaker:** Same as analytics. applications_total, approved_total, declined_total, withdrawn_total; approval_rate = approved / (approved + declined) when denominator > 0 (from analytics).
- **Sponsor:** Same as analytics (project). proposals_total, accepted_total, declined_total, pending_total; acceptance_rate = accepted / (accepted + declined) when denominator > 0 (from analytics).
- **Host:** Same as analytics for hosted_spaces_total, sponsor_proposals_*, sponsor_acceptance_rate. **approved_speakers_total** = COUNT(*) FROM speaker_requests WHERE status = 'approved' AND space_id IN (current user’s hosted space ids). No fake score; counts and rates only.

---

## 4. UI summary

- **Placement:** XSpaces Home → Analytics tab. Below the existing 4 analytics StatCards, a second card block titled **Reputation**.
- **Content:** When reputation data is available: 4 StatCards — Speaker Approval Rate, Sponsor Acceptance Rate, Hosted Spaces, Approved Speakers Hosted. Same StatCard component as analytics; compact, token-based.
- **Loading:** "Loading reputation…" when reputation is loading and not yet available. Reputation block only rendered when reputation is loading or loaded (not when user is logged out or fetch failed).
- No redesign; incremental addition only.

---

## 5. Manual QA checklist

- [ ] GET /api/xspaces/reputation without auth → 401.
- [ ] GET /api/xspaces/reputation with valid Bearer → 200; body has speaker, sponsor, host; host has approved_speakers_total; counts match analytics where applicable; approved_speakers_total matches count of approved speaker_requests on user’s spaces.
- [ ] Response contains no wallet_address, message, pitch, requested_deliverables, or PII.
- [ ] XSpaces Home → Analytics tab: analytics cards load as before; reputation block appears below; shows Speaker Approval Rate, Sponsor Acceptance Rate, Hosted Spaces, Approved Speakers Hosted when reputation loads.
- [ ] When reputation fails or user not logged in, analytics tab still works; reputation section shows loading or no sensitive data.
- [ ] Add from X, speaker applications, sponsor propose/accept/decline, payout preferences, notifications, My proposals, profile/dashboard, GET /api/spaces/[id] visibility: unchanged.
- [ ] GET /api/xspaces/analytics: unchanged behavior and response shape.

---

## 6. Confirmations

- **Add from X fix remains intact.** No edits to Add from X modal, session refresh, or sync-from-x logic.
- **Analytics endpoint remains intact.** No code or behavior changes to GET /api/xspaces/analytics; reputation reuses it via internal fetch only.
- **Profile/dashboard real-data behavior remains intact.** No changes to profile or dashboard data fetching or display.
- **Sponsor workflow remains intact.** No changes to proposal creation, accept/decline, payout recording, inbox, or My proposals.

---

## 7. Future public reputation badges (suggestion)

When product is ready to show public credibility:

- **Option A:** New read-only endpoint, e.g. **GET /api/profiles/[id]/xspaces-reputation** (or /api/xspaces/public-reputation?profile_id=…), returning only **public-safe aggregates**: e.g. hosted_spaces_total, sponsor_proposals_accepted, approved_speakers_total (no rates or counts that reveal other users’ activity). Require no auth for read; do not expose wallet, messages, pitches, or deliverables.
- **Option B:** Add optional fields to existing profile/public APIs (e.g. xspaces_hosted_count, xspaces_sponsors_accepted, xspaces_speakers_approved) if the profile contract can be extended without breaking clients.
- Keep logic aligned with current reputation formulas (same tables: spaces, speaker_requests, space_sponsor_proposals) and no new scoring or weighting.

Part 3 (optional public-safe credibility) was **not implemented** in this change; no public profile or public API was modified. The above is the recommended next step when exposing reputation publicly.
