# Phase 1 — Information Architecture & Analytics Consolidation

**Audit type:** Structural (pre-launch, 100k+ scale)  
**Ownership:** Senior Product Architect + Staff Engineer  
**Directive:** Resolve analytics duplication and define a single source of truth for analytics ownership.

---

## 1. Current Route Map

### 1.1 Client-side routes (figma App.tsx)

| Route name       | Path pattern              | Component / Content |
|------------------|---------------------------|----------------------|
| landing          | `/`                       | LandingPage          |
| overview         | `/overview`               | OverviewPage (home)  |
| dashboard        | `/dashboard`              | DashboardPage        |
| profile          | `/profile`, `/profile?tab=overview\|insights`, `?username=` | ProfilePage (Overview tab + **Insights tab**) |
| profileEdit      | `/profile/edit`           | ProfileEditPage      |
| profile (legacy) | `/profile/dashboard`      | Redirect → `/profile?tab=insights` |
| analytics        | `/analytics`              | AnalyticsPage        |
| userProfile      | `/{username}`             | UserProfilePage (other user) |
| orgDetail        | `/org/[orgId]`            | OrgDetailPage (tabs: overview, insights) |
| market           | `/market`                 | MarketplacePage      |
| messages         | `/messages`               | MessagesPage         |
| circles          | `/circles`                | CirclesOverviewPage  |
| connections      | `/connections`            | ConnectionsPage      |
| watchlist        | `/watchlist`              | WatchlistPage        |
| integrations     | `/settings/integrations`  | IntegrationsPage     |
| rolesSkills      | `/settings/roles-skills`  | RolesSkillsPage      |
| wallet           | `/settings/wallet`        | WalletShell          |
| + terms, privacy, login, onboarding, billing, pricing, etc. | — | Various |

### 1.2 Next.js app routes (entry points)

- `/dashboard`, `/analytics`, `/profile`, `/overview`, `/profile/edit`, `/profile/dashboard` (redirect), `/(public)/[username]` (public one-pager with metadata), `/org/[orgId]`, etc.  
- The main UX is the single client-routed app; pathname + searchParams drive `routeFromPathname` and the corresponding component is rendered inside `App.tsx`.

---

## 2. Duplication: Dashboard vs Analytics vs Profile Insights

### 2.1 Dashboard (`/dashboard` — DashboardPage)

- **Purpose (current):** “Personal Analytics & Brand Management Dashboard.”
- **Content:** Personal stats (volume, deals, completion rate, rating, profile views, engagement), brand cards with revenue/projects/followers/engagement, volume trend chart (personal vs brand), reputation growth (ETHOS, XScore, Index), weekly activity, categories pie, skills comparison, search (people/projects/orgs), org list, active deals, creator/project/agency/user type cards.
- **Data:** `listOrgsForUser`, `listMyDeals`, demo/mock for personal stats; no direct call to `/api/analytics/x` or `/api/social/insights`.
- **Charts:** Recharts (Line, Area, Bar, Pie, Radar) for volume, reputation, weekly activity, categories, skills.
- **Verdict:** Dashboard is **brand + deal + high-level personal KPIs**. It is **not** the deep X/time-series analytics hub; it is a **command center** for “my work and my brands.”

### 2.2 Analytics (`/analytics` — AnalyticsPage)

- **Purpose (current):** “Signals-First Dashboard — Rich insights with numbers + AI-ready signal system. Platform-agnostic structure (X now, YouTube/TikTok later).”
- **Content:** Init status, 90d backfill, X analytics from `/api/analytics/x` and `/api/analytics/x/summary`, KPIs (followers, engagement, etc.), top drivers (tweets), baseline, snapshots, rebuild job, diagnostics. Uses `AnalyticsTabContent` for charts/tables.
- **Data:** `GET /api/analytics/init-status`, `GET /api/analytics/x`, `GET /api/analytics/x/summary`, `POST /api/analytics/backfill-90`, `POST /api/analytics/x/rebuild`, `GET /api/analytics/x/job`. **Auth-only** (Bearer); always **current user**.
- **Verdict:** Analytics is the **single deep analytics hub** for the logged-in user: X time-series, rollups, top drivers, backfill, job status. This is where “deep charts” and “full analytics” live.

### 2.3 Profile (`/profile`) — Overview tab

- **Content:** Profile card (name, handle, location, score pills, reviews, volume, bio, roles, ambassador, partnerships, links), featured work, upcoming events, case studies, discover people, reviews. Data: `GET /api/profile/me-stats` (and profile edit/case studies, search).
- **Verdict:** **Identity + credibility snapshot** (score, reviews, volume, links). No time-series charts; no top drivers; no backfill. Snapshot only.

### 2.4 Profile Insights tab (`/profile?tab=insights` — InsightsTab)

- **Content:** ProfileHeaderCard (name, handle, bio, pills, Copy link, Watchlist), “Refresh insights” (calls `POST /api/profile/refresh-x-insights`), then **islands:** ScoreCard (Linkary Score, breakdown, tips), TopFollowersCard (influencers/projects/funds), SocialGraphCard (followers/score over time), Insights summary (followers, connected X, data health, last updated), AffiliatedAccountsCard, RecommendedAccountsCard.
- **Data:** `GET /api/profile/me-stats`, `GET /api/analytics/x`, `GET /api/social/insights?provider=x&username=...` (own or other via `?username=`), `POST /api/profile/refresh-x-insights` (own only, rate-limited).
- **Verdict:** **Duplicate of “X insights”** in a profile context: same score breakdown, same social graph concept, same top followers, plus cache/refresh. It reuses **both** analytics APIs and social-insights API. **Cross-user:** `?username=` allows viewing another user’s insights (public or with permission); `/api/social/insights` is **unauthenticated** and resolves by username.

---

## 3. Mental Model (Target)

| Concept     | Definition |
|------------|------------|
| **Dashboard** | **Command center:** “My work, my brands, my deals.” High-level KPIs (volume, completion rate, rating, profile views), brand list and brand-level metrics, volume/reputation trend charts at a **summary** level. No deep X time-series, no top drivers, no backfill controls. |
| **Analytics** | **Deep analytics hub (single place):** “My X (and future: YouTube/TikTok) performance.” Init status, 90d backfill, rollups, snapshots, top drivers, rebuild, diagnostics. **Only** `/analytics` owns “deep charts” and “full analytics” for the logged-in user. |
| **Profile**   | **Identity + credibility snapshot:** Bio, score, reviews, volume, links, featured work, case studies. **Snapshot only** — no time-series, no “Refresh insights” for X. Optional: one small “Credibility” or “Score” block that links to Analytics for “See full analytics →”. |
| **Org**       | **Organization context:** Org detail with tabs; “Insights” tab = influence rollup, supporters, (future) org-level analytics. Not the same as personal Analytics. |

---

## 4. Final v1 Sitemap (Recommended)

- **`/`** — Landing (or redirect to /overview when logged in, per product).
- **`/overview`** — Home (discovery, featured, CTA).
- **`/dashboard`** — My Dashboard: brands, deals, personal KPIs, summary charts (volume trend, reputation growth, weekly activity). No X deep analytics.
- **`/analytics`** — **Only** deep analytics: X (and later YouTube/TikTok). Init, backfill, rollups, top drivers, time-series. Single owner of “deep charts.”
- **`/profile`** — My Profile: Overview (snapshot) **only**. No “Insights” tab.
- **`/profile/edit`** — Profile Builder.
- **`/{username}`** — Public or other-user profile (snapshot); optional “View full analytics” only for self when logged in (links to `/analytics`).
- **`/org/[orgId]`** — Org detail (overview + org-level insights tab).
- **`/market`**, **`/messages`**, **`/circles`**, **`/connections`**, **`/watchlist`**, settings routes — unchanged.

**Removed from IA:**

- **`/profile?tab=insights`** as a primary destination. **Recommendation:** Remove the Profile “Insights” tab entirely for v1; surface a single “Linkary Score” or “Credibility” card on Profile (Overview) that shows score + CTA “See full analytics →” linking to `/analytics`. If product insists on “something on profile,” reduce to a **Snapshot module only** (score + follower count + “See full analytics” link), with no duplicate charts, no Refresh insights, no top followers list on profile.

---

## 5. Page Responsibility Matrix

| Page        | Snapshot / summary metrics | Deep charts (time-series, drivers) | Backfill / refresh controls | Cross-user (?username=) |
|-------------|----------------------------|------------------------------------|-----------------------------|-------------------------|
| Dashboard   | Yes (personal + brand KPIs) | Summary charts only (trend, not raw X) | No                          | No                      |
| Analytics   | Yes (KPIs + rollups)       | **Yes (single owner)**             | Yes                         | No (auth, current user)  |
| Profile     | Yes (score, reviews, volume) | **No**                          | No                          | Yes (view other profile) |
| Profile Insights (current) | Yes (score, followers) | Yes (social graph, duplicate) | Yes (refresh)               | Yes                     |
| Org detail  | Yes (org rollup)           | Org-level only (future)           | No                          | N/A                     |

---

## 6. Analytics Ownership Decision

**Single owner of “deep” analytics:** **`/analytics`** (AnalyticsPage).

- **Dashboard:** Does **not** own deep X analytics. It may consume **summary** metrics (e.g. from `/api/analytics/x/summary` or a single “profile snapshot” endpoint) for a small “X summary” tile that links to “Full analytics →”.
- **Profile:** Does **not** own X insights charts, top followers, or refresh. Profile = snapshot (score, reviews, volume). Option A: remove Insights tab. Option B: replace with a **Snapshot module only** (score + follower count + “See full analytics” link).
- **Cross-user:** Viewing another user’s “insights” (e.g. `?username=`) should show at most a **snapshot** (public score, follower count if public). Full charts/top followers stay in Analytics and are **own-profile only** unless product explicitly defines “shared analytics” later.

**Recommendation:** **Remove Profile Insights tab** for v1. Add on Profile (Overview) one “Credibility” or “X summary” card: score + follower count + “See full analytics” → `/analytics`. This removes duplication, clarifies mental model, and keeps one place for deep charts and refresh/backfill.

---

## 7. P0 Structural Changes Required

1. **Decide and document:** Profile Insights = **removed** OR **snapshot-only** (score + link to Analytics). No duplicate social graph, top followers, or “Refresh insights” on Profile.
2. **Redirect `/profile/dashboard`** to `/analytics` (not `/profile?tab=insights`) if the intent is “see my analytics”; or keep redirect to `/profile?tab=insights` only if snapshot-only option is chosen and that tab is renamed (e.g. “X summary”).
3. **Dashboard:** Ensure it does not fetch `/api/analytics/x` or `/api/social/insights` for full charts; at most a summary endpoint or cached snapshot for a single “X” tile with link to Analytics.
4. **Analytics:** Remain the only page that calls backfill, rebuild, init-status, and full `/api/analytics/x` for current user. No `?username=` on Analytics.
5. **Cross-user profile view:** When viewing another user’s profile (`?username=` or `/{username}`), show only snapshot data (score, followers if public). No “Insights” tab for other users, or show a “Snapshot” that does not duplicate Analytics.
6. **Sidebar/nav:** “My Dashboard” → Dashboard; “Analytics” → Analytics. If Profile Insights is removed, remove “Insights” from Profile tab bar and any nav that points to “profile insights.”

---

## 8. Summary

- **Dashboard** = command center (brands, deals, summary KPIs and summary charts).  
- **Analytics** = single deep analytics hub (X now; YouTube/TikTok later); only place for deep charts and backfill/refresh.  
- **Profile** = identity + credibility snapshot; no duplicate analytics; optional small “X summary” card with link to Analytics.  
- **Profile Insights tab:** **Remove** (recommended) or **reduce to snapshot-only** to avoid duplication and confusion.  
- **Final sitemap** and **page responsibility matrix** above define ownership and P0 changes.
