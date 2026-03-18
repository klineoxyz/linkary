# P0 launch-readiness pass (IA · SEO · performance · profile boundaries)

**Date:** 2026-03-18 · **Scope:** surgical; no CRM/sourcing/onboarding/analytics-truth rewrites.

---

## 1) Audit summary

### Already correct (unchanged)

| Area | Status |
|------|--------|
| **Public profile** `/{username}` | Strong `generateMetadata`: canonical, OG, Twitter, noindex when unpublished |
| **Sitemap** | Homepage + published profiles/orgs; dynamic regen |
| **robots.txt** | Existed; disallowed `/app`, `/profile`, `/api`, `/auth`, `/login`, etc. |
| **App shell noindex** | `app/app/layout.tsx` + `profile/layout.tsx` + `analytics/layout.tsx` use `robots: noindex` |
| **Analytics data** | Stored-data SWR; refresh via explicit actions (no live provider on passive load) |
| **Canonical public profile** | Sitemap uses `/{username}`; copy-link uses `NEXT_PUBLIC_APP_URL` |

### Partially addressed before; tightened this pass

| Gap | Change |
|-----|--------|
| Analytics IA overlap | `/app/profile/insights` was full **Insights** (top followers, graph) overlapping **Analytics** |
| Root SEO | Root layout lacked `metadataBase`, default OG/Twitter, title template |
| Heavy routes | Dashboard/Analytics dynamic-loaded without loading UI; Cross-user analytics + Insights eager-loaded |

### Implemented this pass

- **IA:** Own **Profile → Insights** is now **snapshot-only** (header + trust strip + CTA to `/app/analytics`). Full charts stay on **Analytics**.
- **Profile tabs:** Primary **Full analytics** → `/app/analytics`; secondary **Quick snapshot** → `/app/profile/insights` (with title tooltip).
- **SEO:** Root `metadataBase`, OG/Twitter defaults, title template, canonical base URL.
- **robots:** Extra disallows for `/work`, `/xspaces`, `/onboarding`, `/verification`, `/account-type`.
- **Performance:** Loading fallbacks on Dashboard + Analytics chunks; lazy **InsightsSnapshot** + **CrossUserAnalyticsPage**.

---

## 2) Files touched

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/robots.ts`
- `apps/web/src/figma/app/App.tsx`
- `apps/web/src/figma/app/components/profile/InsightsSnapshot.tsx`

---

## 3) Migrations

**None.**

---

## 4) QA checklist (route-by-route)

| Route | Check |
|-------|--------|
| `/` | Title/OG fall back to root metadata; app loads |
| `/{publishedUsername}` | Canonical + OG unchanged; still indexable |
| `/app/dashboard` | Loads; skeleton then content; org/deals flows OK |
| `/app/analytics` | Charts + refresh UX; no new network pattern |
| `/app/profile` | Tabs: Full analytics primary; Quick snapshot thin page |
| `/app/profile/insights` | Snapshot only; button → `/app/analytics` |
| `/app/profile/edit` | Edit-only; no regression |
| `/app/analytics/profile/{user}` | Lazy load; cross-user analytics works |
| `/robots.txt` | New paths disallowed |
| Login/settings | Still noindex via existing layouts |

---

## 5) Regression check

- [ ] **CRM** — not touched  
- [ ] **Org sourcing** — not touched  
- [ ] **Creator org-invites inbox** — not touched  
- [ ] **Invite onboarding** — not touched  
- [ ] **Analytics refresh/status** — AnalyticsPage logic unchanged  
- [ ] **Active context** — not touched  

---

## 6) Intentionally deferred

- **Dashboard vs Analytics chart overlap:** Personal dashboard still contains deal/reputation charts (command center + volume); full X analytics remains on **Analytics** only for X time-series/backfill.
- **Landing page OG image:** Root uses text OG; profile pages use `/api/og`. Custom landing OG asset optional later.
- **Explore / xspaces indexing:** Explore not disallowed (may be marketing); xspaces disallowed as app-adjacent.
- **Systematic dark-token purge** across Dashboard 1.3k lines — Analytics already on `bg-background`/`border-border`; full Dashboard sweep deferred.
- **ProfileEditPage / Dashboard recharts** split into sub-chunks — deferred (dynamic route-level import only this pass).
