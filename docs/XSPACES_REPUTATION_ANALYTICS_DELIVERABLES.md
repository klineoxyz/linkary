# XSpaces Reputation + Analytics — Implementation Deliverables

## 1. Files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260312000000_xspaces_analytics_indexes.sql` | **New.** Two composite indexes on `space_sponsor_proposals`. |
| `apps/web/src/app/api/xspaces/analytics/route.ts` | **New.** GET handler: auth, read-only queries, aggregated JSON response. |
| `apps/web/src/figma/app/components/xspaces/HomeView.tsx` | Optional `analytics` and `analyticsLoading` props; Analytics tab shows 4 StatCards or loading/unavailable. |
| `apps/web/src/figma/app/components/xspaces/index.ts` | Export `XSpacesAnalytics` type. |
| `apps/web/src/figma/app/components/XSpacesPage.tsx` | State for `xspacesAnalytics` and `xspacesAnalyticsLoading`; effect to fetch GET /api/xspaces/analytics when `mainNav === "home"` and `me?.id`; pass props to HomeView. |
| `docs/XSPACES_REPUTATION_ANALYTICS_PLAN.md` | **Existing.** Implementation plan (no code). |
| `docs/XSPACES_REPUTATION_ANALYTICS_DELIVERABLES.md` | **New.** This file. |

No changes to: Add from X flow, session refresh, speaker applications, sponsor proposal accept/decline, payout preferences, notifications, My proposals dashboard, profile/dashboard real-data, GET /api/spaces/[id], Connect X, or Detect my Space.

---

## 2. Migration(s) added

- **`20260312000000_xspaces_analytics_indexes.sql`**
  - `CREATE INDEX IF NOT EXISTS idx_space_sponsor_proposals_project_status ON public.space_sponsor_proposals (project_profile_id, status);`
  - `CREATE INDEX IF NOT EXISTS idx_space_sponsor_proposals_space_status ON public.space_sponsor_proposals (space_id, status);`
  - Idempotent; no table or column changes.

---

## 3. Routes added

- **GET /api/xspaces/analytics**
  - Auth required (Bearer token). 401 if missing or invalid session.
  - Returns JSON: `host`, `speaker`, `project`, `accepted_sponsorship_volume` (aggregates only; no PII).

---

## 4. Reputation formulas used

- **Speaker** (requester_profile_id = current user): counts by status from `speaker_requests`; `approval_rate = approved / (approved + declined)` when denominator > 0.
- **Project** (project_profile_id = current user): counts by status from `space_sponsor_proposals`; `acceptance_rate = accepted / (accepted + declined)` when denominator > 0; `accepted_sponsorship_volume = SUM(offer_amount)` where status = 'accepted'.
- **Host** (host_profile_id = current user): `hosted_spaces` from `spaces`; proposal counts from `space_sponsor_proposals` where `space_id IN (my space ids)`; `sponsor_acceptance_rate = accepted / (accepted + declined)` when denominator > 0.
- All rates rounded to 3 decimal places; no artificial scoring.

---

## 5. UI summary

- **Placement:** XSpaces Home → **Analytics** tab (replaces “Analytics coming soon”).
- **Behavior:** When user is logged in and on Home, analytics are fetched in the background. When the user opens the Analytics tab:
  - If loading and no data: “Loading…”
  - If data: 4 cards (reusing `StatCard` from SharedComponents): **Hosted Spaces**, **Speaker Approval Rate**, **Sponsor Proposals Accepted**, **Sponsor Acceptance Rate** (host rate).
  - If unavailable (e.g. not logged in or fetch failed): “Analytics unavailable.”
- No redesign of the page; minimal additions only.

---

## 6. QA checklist

- [ ] Run migration; confirm indexes exist; no errors.
- [ ] GET /api/xspaces/analytics without auth → 401.
- [ ] GET /api/xspaces/analytics with valid Bearer → 200; body has `host`, `speaker`, `project`; counts and rates consistent with DB.
- [ ] Response contains no `wallet_address`, `message`, `pitch`, `requested_deliverables`, or other user PII.
- [ ] XSpaces Home → Analytics tab: when logged in, numbers appear (or “—” for rates when no decisions); when not logged in, “Analytics unavailable.” or no sensitive data.
- [ ] Add from X, speaker apply/withdraw/approve, sponsor propose/accept/decline, payout preferences, inbox, My proposals, profile/dashboard, space visibility, Connect X, Detect my Space: behavior unchanged.

---

## 7. Confirmations

- **Add from X fix remains intact:** No edits to Add from X modal, session refresh, or sync-from-x logic.
- **Profile/dashboard real-data logic remains intact:** No changes to profile or dashboard data fetching or display.
- **Sponsor proposal workflow unchanged:** No changes to proposal creation, accept/decline, payout destination recording, or inbox/My proposals flows.
