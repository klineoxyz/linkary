# First-user onboarding & launch polish — audit

**Question:** Is the full pass (product designer / onboarding UX spec) **done**?  
**Answer:** **Partially.** Core flows work; holistic polish and role-aware guidance are **not** fully implemented. This doc records what’s in place, gaps, and QA.

---

## 1) Audit summary

### Already launch-ready (felt good)

| Area | Notes |
|------|--------|
| **Invite + X-first onboarding** | `XFirstOnboarding`: invite (when required) → Individual/Company → professions → app. See `ONBOARDING_X_FIRST_DELIVERABLES.md`. |
| **Invite gate** | Invite-only users blocked until redeem; onboarding route allowed. |
| **Profile privacy line** | `/app/profile` states workspace is private + public preview / Public View. |
| **Profile navigation** | Overview / Public preview tabs, Advanced editor, Full analytics, Quick snapshot, Public View CTA. |
| **Dashboard** | My Orgs first, create-org empty copy, Analytics pointer in banner. |
| **Analytics owner states** | Banners / empty KPI copy from stored-data-only model (`analytics-owner-state-presentation`). |
| **Public profile** | `[username]` route + `StarterBlock`; snapshot insights for others (no deep leak). |

### Partially good but confusing

| Area | Issue |
|------|--------|
| **Dashboard** | Dense; no single “what to do first” until **First steps** card added (dismissible). |
| **Creator vs org operator** | Same dashboard shell; company users get “Admins & team” on profile but no org-first checklist. |
| **Analytics vs Insights** | Multiple entry points; users must read small print. |
| **Empty states** | Mixed quality—some intentional, some feel sparse (no unified tone pass). |

### Clearly missing vs original spec (not all built)

| Spec item | Status |
|-----------|--------|
| Role-aware completion checklist (creator vs org) | **Light:** generic first-steps card only; no profession-based branching. |
| Progress for profile completion | **Not** a dedicated progress meter. |
| Success states (profile complete, analytics ready, org ready, checklist done) | **Not** implemented as dedicated screens/toasts. |
| Full empty-state rewrite (every surface) | **Not** done—targeted copy only where touched. |
| Public profile section order / fallbacks pass | **Partial**—no large reorder in this pass. |
| Heavy tour / gamification | Correctly **absent**. |

---

## 2) What was changed (this follow-up)

| Change | Purpose |
|--------|---------|
| `FirstStepsOnLinkaryCard` on **Dashboard** | Dismissible (session) map: Profile → Integrations (X) → Analytics → Org. |
| **Profile** copy tightened | Clear bullets: private workspace / edit → public / analytics private. |

---

## 3) Files touched (UX pass follow-up)

- `apps/web/src/figma/app/components/FirstStepsOnLinkaryCard.tsx` (new)
- `apps/web/src/figma/app/components/DashboardPage.tsx` (embed card)
- `apps/web/src/figma/app/App.tsx` (profile explainer copy)
- `docs/FIRST_USER_ONBOARDING_UX_AUDIT.md` (this file)

**Migrations:** none.

---

## 4) Route-by-route QA (first-user quality)

| Route | Check |
|-------|--------|
| `/onboarding` | Invite → role → profession → lands in app without dead ends. |
| `/app/dashboard` | First steps card visible once; dismiss persists session; orgs block readable. |
| `/app/profile` | Privacy + edit/public/analytics boundaries clear. |
| `/app/profile/edit` | Saves reflect on public preview / `/{username}`. |
| `/[username]` | No awkward blank hero; missing data has fallback copy. |
| `/app/analytics` | No X: clear CTA to Integrations; building state not “broken”. |
| Org entry | Create org → detail opens; members CTA obvious. |
| Context switch | Personal vs org: user knows which space they’re in (nav/active context). |

---

## 5) Regression (unchanged by this UX pass)

- CRM, org sourcing, creator org-invites inbox, invite gate, analytics refresh/status contracts, active context — **no logic changes** in intended scope.

---

## 6) Verdict

| | |
|--|--|
| **Polished enough for broader onboarding?** | **Cautious yes** for **invited** users who tolerate discovery; **not** “fully polished” vs the full 8-point spec. |
| **True user-facing blockers** | None structural—blockers are **inconsistent empty copy** and **no success celebrations** if you want a premium first-run feel. |

**Recommended next slice (if continuing):** (1) Org-operator variant of first-steps when `account_type === company'` and `myOrgs.length === 0`. (2) One success toast/banner after onboarding completion. (3) Single pass on `/app/analytics` + Integrations empty states for “never synced”.
