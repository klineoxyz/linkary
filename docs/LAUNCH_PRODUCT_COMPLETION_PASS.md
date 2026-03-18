# Launch product completion pass — summary

**Date:** 2026-03-18  
**Scope:** Individual profile, org workspace, CRM (creator + operator), Linkary↔CRM clarity, route fixes.  
**Explicitly not changed:** Onboarding flow, referrals, referral distribution, RLS/truth models, analytics live-fetch boundaries, active context API, CRM sync contracts.

---

## 1) Audit summary

### Already good (kept as-is)
- **Org authority** via `org_members` + org mode switcher; org dashboard “operator workspace” copy.
- **Analytics** as stored snapshots; no passive live provider calls (unchanged).
- **Profile private workspace** (`ProfilePage`) with public vs private explainer; public preview iframe.
- **CRM data model**: tasks, bundles, submissions, campaigns, contribution % (operator-side).
- **Sourcing pipeline** grounded in org tab; separate from CRM execution.

### Was confusing / incomplete → addressed
| Issue | Change |
|-------|--------|
| `/app/profile/deals` and `/app/profile/applications` **redirected to Overview** (not in `ALLOWED_ROUTES`) | Added routes + in-shell panels (`GigDealsPanel`, `MyApplicationsPanel`). |
| `/app/analytics/profile/[user]` likely same redirect | Added **`analyticsProfile`** to `ALLOWED_ROUTES`. |
| Users unclear Linkary vs CRM | Copy on profile, gigs & deals, org dashboard, CRM sidebar + tasks header + campaign banner. |
| “Profile Builder” vs profile | Renamed nav to **Edit public page**; clearer gig applications path. |
| CRM single URL per submit | **Up to 3 proof URLs** per submit action (still one row per URL in DB). |
| CRM empty tasks | Empty state explains **Linkary accept → sync → tasks**. |
| CRM `/submissions` & `/reports` were “coming soon” dead ends | Pages now **direct users to Campaigns** for real review/report flows. |

### Still missing / launch-order blockers (not in this pass)
- **YouTube/TikTok/Facebook** native sections (UI explains X-first; same submission path).
- **Dedicated unified “Reports hub”** in CRM (reports live per-campaign today).
- **Real-time sync visibility** if tasks don’t appear (ops/debug UX).
- **Mobile polish** on every surface (spot-check high-traffic routes only in QA below).

---

## 2) Files touched

### `apps/web`
- `src/lib/crmPublicUrl.ts` **(new)** — `NEXT_PUBLIC_CRM_APP_URL` or prod default.
- `src/components/profile-work/GigDealsPanel.tsx` **(new)**
- `src/components/profile-work/MyApplicationsPanel.tsx` **(new)**
- `src/app/profile/deals/page.tsx` — uses `GigDealsPanel`
- `src/app/profile/applications/page.tsx` — uses `MyApplicationsPanel`
- `src/figma/app/App.tsx` — allowed routes, renders deals/applications, CRM links in sidebar, profile CRM bullet, nav labels
- `src/figma/app/components/OrgDetailPage.tsx` — sourcing vs CRM line + CRM link

### `apps/crm`
- `src/components/DashboardShell.tsx` — Linkary vs CRM footer; campaign nav label
- `src/app/(dashboard)/tasks/page.tsx` — header + empty state copy
- `src/app/(dashboard)/tasks/MyCampaignBundles.tsx` — grouping explainer
- `src/app/(dashboard)/tasks/[id]/TaskDetailClient.tsx` — 3 links, X-first copy
- `src/app/(dashboard)/tasks/[id]/actions.ts` — batch up to 3 submissions
- `src/app/(dashboard)/campaigns/[id]/page.tsx` — operator banner
- `src/app/(dashboard)/submissions/page.tsx` — CTA to campaigns
- `src/app/(dashboard)/reports/page.tsx` — CTA to campaigns

### Docs
- `docs/LAUNCH_PRODUCT_COMPLETION_PASS.md` **(this file)**

---

## 3) Migrations

**None.** All changes are UI/copy and route allowlist; submissions remain one row per URL.

---

## 4) Route inventory (touched or behavior-fixed)

| Route | Note |
|-------|------|
| `/app/profile` | CRM bullet in explainer |
| `/app/profile/deals` | **Now works** in main shell |
| `/app/profile/applications` | **Now works** in main shell |
| `/app/analytics/profile/[username]` | **No longer bounced** to overview |
| `/profile/deals`, `/profile/applications` | Still work standalone |
| `/org/...` | Org dashboard CRM vs sourcing copy |
| CRM `/tasks`, `/tasks/[id]` | Grouping + 3-link submit + empty state |
| CRM `/campaigns/[id]` | Operator banner |
| CRM `/submissions`, `/reports` | Helpful redirects to campaigns |

---

## 5) CRM flow summary (after changes)

**Creators**
1. Accept work on **Linkary** → tasks sync to CRM (existing sync).
2. **Tasks** lists personal + campaign tasks; **campaign cards** filter by gig/campaign.
3. Open task → submit **1–3 proof URLs** (X default platform label); see **pending / approved / rejected** on each submission; contribution % on bundle card when set by operator.

**Orgs**
1. **Sourcing / jobs / programs** on Linkary org workspace.
2. **CRM → Campaigns** → open campaign → KPIs + **submission table** → Approve / Reject / Needs revision → report link for CPV/CPM-style metrics where data exists.

---

## 6) QA checklist (route-by-route)

### Individual first-run
- [ ] Login → land not broken; onboarding untouched
- [ ] Sidebar: My profile, Edit public page, Gigs & deals, Gig applications, CRM link opens

### Profile / public / share
- [ ] `/app/profile` — explainer + public preview + full analytics link
- [ ] Public page `/{username}` — unchanged behavior
- [ ] `/app/profile/edit` — save still updates public page

### Analytics
- [ ] `/app/analytics` — refresh still queued/stored only
- [ ] `/app/analytics/profile/[user]` — loads (not redirect to overview)

### Org mode
- [ ] Switch to org → overview shows sourcing vs CRM sentence
- [ ] Sidebar **CRM — review campaigns** opens CRM
- [ ] Jobs, sourcing, KOL lists unchanged

### KOL / invites
- [ ] KOL lists + org invites flows unchanged

### CRM creator
- [ ] Empty tasks → copy mentions Linkary accept + sync
- [ ] Campaign bundle card → filter tasks
- [ ] Task detail → 3 URL fields → creates up to 3 pending submissions
- [ ] Status labels readable

### CRM org
- [ ] Campaign detail → banner + review actions
- [ ] `/submissions` → link to campaigns works

### Mobile (high traffic)
- [ ] `/app/profile`, `/app/profile/deals`, CRM `/tasks` — usable width, sidebar

---

## 7) Regression checklist

- [ ] Sourcing pipeline cards / stages (no code path changed)
- [ ] Org invites + job invites
- [ ] Analytics refresh / ensure-backfill APIs
- [ ] Active context cookie + org switcher
- [ ] Onboarding + referrals (untouched)
- [ ] CRM sync API after deal accept (unchanged)

---

## 8) Final verdict

**Is Linkary simple enough for real users now?**  
**Closer:** Critical bug (**deals/applications/analytics-profile routes killing the shell**) is fixed; Linkary↔CRM is explained in nav, profile, deals, org dashboard, and CRM. Task submission matches “up to 3 links” and empty states set expectations.

**Blockers for a confident launch (priority order)**  
1. **Env:** Set `NEXT_PUBLIC_CRM_APP_URL=https://crm.linkary.xyz` on **web** Vercel so links point to production CRM (fallback already `crm.linkary.xyz` in code when not localhost).  
2. **E2E smoke:** One full path Linkary accept → CRM task → submit → org approve.  
3. **Optional:** Replace placeholder CRM reports hub when product wants a single entry.

---

## Env note

Add to **apps/web** deployment:

```bash
NEXT_PUBLIC_CRM_APP_URL=https://crm.linkary.xyz
```

(Local dev defaults to `http://localhost:3001` when unset—adjust if your CRM port differs.)
