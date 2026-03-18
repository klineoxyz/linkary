# Release-candidate UX pass — deliverables

## 1) Audit summary

| | |
|--|--|
| **Already good** | X-first onboarding, invite gate, profile tab map, analytics owner copy module, org tab scroll, dashboard org block. |
| **Partially done** | First-steps card → replaced by richer **NextBestActionSuite**; public profile CTAs pointed at wrong `/profile/edit` paths. |
| **What changed** | Role-aware checklist (creator vs company), success banners (onboarding, org created, share-ready, analytics loaded), gentler analytics empty copy, mobile padding/overflow on dashboard/profile/analytics/org, public bio fallback + fixed edit links, StarterBlock edit URL. |

## 2) Files touched

- `apps/web/src/lib/releaseCandidateUx.ts` (new — session keys)
- `apps/web/src/figma/app/components/NextBestActionSuite.tsx` (new — replaces FirstStepsOnLinkaryCard)
- `apps/web/src/figma/app/components/XFirstOnboarding.tsx` — `linkary_rc_onboarding_done` on complete
- `apps/web/src/figma/app/components/DashboardPage.tsx` — `profileHints`, org-created flag, `#my-orgs`, responsive shell
- `apps/web/src/figma/app/App.tsx` — passes `profileHints` to dashboard; profile layout mobile
- `apps/web/src/figma/app/components/AnalyticsPage.tsx` — ready banner, tab scroll, padding
- `apps/web/src/figma/app/components/OrgDetailPage.tsx` — responsive header shell
- `apps/web/src/lib/analytics-owner-state-presentation.ts` — warmer empty/banner copy
- `apps/web/src/app/(public)/[username]/StarterBlock.tsx` — `/app/profile/edit`, copy
- `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` — bio fallback, `/app/profile/edit` links
- **Removed:** `FirstStepsOnLinkaryCard.tsx`

## 3) Migrations

**None.**

## 4) Route-by-route QA (first-run & polish)

| Route | Verify |
|-------|--------|
| `/onboarding` | Finish flow → dashboard shows **welcome** banner once |
| `/app/dashboard` | Checklist matches Individual vs Company; **#my-orgs** scroll; dismiss cards |
| `/app/profile` | Explainer + tabs usable on narrow width |
| `/app/profile/edit` | No horizontal bleed at 375px |
| `/app/analytics` | Tabs scroll; **Analytics are loaded** banner once; empty states read well |
| `/[username]` | No bio → soft fallback; owner CTAs → `/app/profile/edit` |
| Org workspace | Back row stacks on mobile; tabs scroll |

## 5) Mobile QA (320 / 375 / 390)

- [ ] Dashboard: no horizontal scroll except intentional org cards grid
- [ ] Profile: tab row scrolls; action buttons wrap
- [ ] Analytics: platform tabs scroll; KPI cards stack
- [ ] Public profile: readable margins; CTAs tappable
- [ ] Org: top bar + tab strip usable one-handed

## 6) Regression

CRM, org sourcing, creator org-invites inbox, invite onboarding, analytics refresh/status contracts, active context — **no intentional logic changes**.

## 7) Verdict

**Safe for broader invited onboarding** after running the QA lists above. Remaining risk: **profile/edit page** itself may still need a dedicated mobile pass if that route uses a heavy editor layout not modified here.

---

## Next step: final bug-bash prompt (for Cursor)

Copy-paste when ready:

```
Act as a principal QA lead, product finisher, and release manager.

Experts for this pass:
QA / bug bash · Next.js App Router · Frontend polish · Supabase/RLS awareness · Performance sanity check · Launch operations

Goal:
Run the final release-candidate bug-bash and finish pass for Linkary before broader invited onboarding.

Critical rules:
- No broad rewrites.
- Fix only real launch bugs, UX dead ends, broken states, console errors, hydration issues, mobile breakages, route confusion, or obvious polish defects.
- Preserve all truth boundaries and auth/privacy rules already implemented.

Scope:
1) Audit all onboarding-critical routes
2) Fix console errors / hydration warnings / loading-state issues
3) Fix mobile breakages and obvious visual defects
4) Fix dead-end CTAs and confusing labels
5) Update stale docs that describe old analytics/privacy behavior
6) Produce a final release verdict: ready / not ready, with exact blockers only

Check these routes:
- /onboarding
- /app/dashboard
- /app/profile
- /app/profile/edit
- /app/analytics
- /[username]
- org entry surface
- creator org-invites inbox
- CRM smoke
- sourcing smoke

Deliverables:
1) Bug-bash summary
2) Exact files touched
3) Any migrations
4) Final QA checklist
5) Final release verdict
```
