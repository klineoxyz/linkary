# Linkary UI Functional Audit

**Scope:** apps/web (Next.js App Router). Wallets and auth flows excluded.  
**Goal:** Launch-ready UI — complete feel, no dead clicks, no duplicate confusion.  
**Date:** 2026-02-18

---

## 1) ROUTE MAP

The app has two layers:

- **Next.js routes** under `apps/web/src/app` (real URLs).
- **Client-side “routes”** inside `LinkaryApp` (`apps/web/src/figma/app/App.tsx`) via `useState({ name: "landing" })` — no URL change.

### Next.js routes

| Route path        | Page file                     | Reachable from UI nav? | Unique or duplicate? |
|------------------|-------------------------------|------------------------|----------------------|
| `/`              | `app/page.tsx`                | Yes (entry)            | Unique               |
| `/app`           | `app/app/page.tsx`            | No (redirects to `/`)  | Redirect only        |
| `/[username]`    | `app/[username]/page.tsx`     | No (direct URL only)   | Unique (real profile)|
| `/test-supabase` | `app/test-supabase/page.tsx`  | No (dev-only, 404 prod)| Dev utility          |

### Client-side “routes” (App.tsx state)

| Route name               | Rendered component           | In sidebar? | Unique value |
|--------------------------|-----------------------------|-------------|--------------|
| landing                  | LandingPage                 | Yes (Home)  | Unique       |
| overview                 | OverviewPage                | Yes         | Unique       |
| dashboard                | DashboardPage               | Yes         | Unique       |
| profile                  | ProfilePage                 | Yes         | “Public Profile” — distinct from userProfile |
| userProfile              | UserProfilePage             | Via topbar avatar | User view |
| creatorProfile           | CreatorProfilePage          | Yes         | Creator demo |
| brandProfile             | BrandProfilePage            | Yes         | Brand demo   |
| agencyProfile            | AgencyProfilePage           | No (from Dashboard only) | Agency demo |
| explore                  | ExplorePage (inline in App) | Yes         | Blog + creators + projects |
| discovery                | DiscoveryPage               | Yes         | Creators + projects + filters (overlaps Explore) |
| leaderboards             | LeaderboardsPage           | Yes         | Unique       |
| market                   | MarketplacePage             | Yes         | Unique       |
| messages                 | MessagesPage                | Yes         | Unique       |
| calendar                 | CalendarPage                | Yes         | Unique       |
| circles                  | CirclesOverviewPage         | Yes         | Unique       |
| circleDetail             | CircleDetailPage            | No (from circles) | Unique |
| createCircle             | CreateCircleFlow (modal)    | From circles | Unique     |
| kolLists                 | KOLListsPage                | Yes         | Unique       |
| capitalPartners          | CapitalPartnersPage         | Yes         | Unique       |
| analytics                | AnalyticsPage               | Yes         | Unique       |
| verification             | VerificationCenterPage      | Yes         | Unique       |
| verificationInbox        | VerificationInboxPage       | **No**      | Orphan route |
| privacy                  | PrivacyDataPage             | Yes         | Unique       |
| showcase                 | ComponentShowcase           | **No**      | Orphan route (dev/showcase) |
| publicCreator            | PublicStandalonePage (individual) | Yes  | Public page  |
| publicProject            | PublicStandalonePage (project)     | Yes  | Public page  |
| publicCompany            | PublicProfileDemo (company)        | Yes  | Public page  |
| monetizationShowcase     | MonetizationShowcase        | Yes         | Hub          |
| monetizationFlowShowcase | MonetizationFlowShowcase    | Yes         | Flow demo (overlaps) |
| pricing                  | PricingPage                 | **No** (nav has pricingRefined) | Duplicate of pricingRefined |
| pricingRefined           | PricingPageRefined          | Yes         | Canonical pricing |
| calendarRefined          | CalendarRefined             | No          | Orphan       |
| enhancedCalendar         | EnhancedCalendarPage         | No          | Orphan       |
| billing                  | BillingPage                  | Yes         | Unique       |
| hostDashboard            | HostDashboard               | Yes         | Unique       |
| availability             | AvailabilitySettings        | Yes         | Unique       |

---

## 2) NAVIGATION MAP

### Top nav (Topbar in App.tsx)

| Item           | Target / behavior |
|----------------|--------------------|
| Logo (none in topbar) | — |
| Search input   | **Dead** — no `onChange`/search handler; placeholder only. |
| ⌘K hint        | No command palette. |
| Messages icon  | `setRoute({ name: "messages" })` ✓ |
| Bell icon      | **Dead** — no `onClick`. |
| Avatar + name  | `setRoute({ name: "userProfile", handle: demo.me.handle })` ✓ |

### Sidebar (App.tsx Sidebar)

| Label              | Points to        | Exists? | Note |
|--------------------|------------------|--------|------|
| Home               | landing          | ✓      | |
| Overview           | overview         | ✓      | |
| My Dashboard       | dashboard        | ✓      | |
| Public Profile     | profile          | ✓      | ProfilePage (settings-style) |
| Creator Profile    | creatorProfile   | ✓      | |
| Brand Profile      | brandProfile     | ✓      | |
| Explore            | explore          | ✓      | |
| Discovery          | discovery        | ✓      | Overlaps Explore (creators/projects) |
| Leaderboards       | leaderboards     | ✓      | |
| Jobs & Sprints     | market           | ✓      | |
| Messages           | messages         | ✓      | |
| Circles            | circles          | ✓      | |
| KOL Lists          | kolLists         | ✓      | |
| Capital Partners   | capitalPartners  | ✓      | |
| Analytics          | analytics        | ✓      | |
| Verification Center | verification   | ✓      | |
| Privacy & Data     | privacy          | ✓      | |
| Flow Showcase      | monetizationFlowShowcase | ✓ | |
| Monetization Hub   | monetizationShowcase | ✓ | |
| Pricing            | pricingRefined   | ✓      | Nav says “Pricing”; route is pricingRefined. “pricing” route exists but unused in nav. |
| Billing            | billing          | ✓      | |
| X Spaces Hub       | hostDashboard    | ✓      | |
| Availability       | availability     | ✓      | |
| Creator Link Page  | publicCreator    | ✓      | |
| Project Link Page  | publicProject    | ✓      | |
| Company Link Page  | publicCompany    | ✓      | |
| Preferences       | **Nothing**      | —      | Button has no `onClick` / `setRoute`. |
| Support            | **Nothing**      | —      | Button has no `onClick`. |
| Sign Out           | **Nothing**      | —      | Button has no `onClick`. |
| Upgrade Now        | **Nothing**      | —      | Button has no `onClick`. |

### Footer

- No footer in App.tsx or layout. Landing page may have its own CTA blocks; no site-wide footer links.

### Summary

- **Orphan routes** (in router, not in nav): `verificationInbox`, `showcase`, `pricing`, `calendarRefined`, `enhancedCalendar`. `circleDetail` and `createCircle` are reached from Circles UI.
- **Dead nav items:** Preferences, Support, Sign Out, Upgrade Now (sidebar); Topbar Search, Bell.

---

## 3) BROKEN INTERACTIONS

| Component     | Button / element   | Location (file:line) | Current behavior | Fix recommendation |
|---------------|--------------------|----------------------|------------------|--------------------|
| Sidebar       | Preferences        | App.tsx:873–874      | No handler       | Add `setRoute({ name: "preferences" })` and a stub page, or remove from nav. |
| Sidebar       | Support            | App.tsx:876–877      | No handler       | Link to support URL or stub route. |
| Sidebar       | Sign Out           | App.tsx:879–881      | No handler       | Wire to auth sign-out when implemented; for now stub route or “Coming soon”. |
| Sidebar       | Upgrade Now        | App.tsx:900–902      | No handler       | `setRoute({ name: "pricingRefined" })` or open upgrade modal. |
| Topbar        | Search input       | App.tsx:953          | No search        | Wire to GlobalSearch or command palette (e.g. ⌘K). |
| Topbar        | Bell               | App.tsx:974–977      | No handler       | `setRoute({ name: "notifications" })` and stub, or open dropdown. |
| HostDashboard | Accept speaker     | HostDashboard.tsx:220 | `alert(…Placeholder)` | Replace with toast + “Coming soon” or real API. |
| HostDashboard | Reject speaker     | HostDashboard.tsx:224 | Same              | Same. |
| CreatorProfileDemo | Message / Hire / Copy | CreatorProfileDemo.tsx:359–371 | `console.log` / copyProfileLink | Copy is OK; Message/Hire → toast “Coming soon” or route. |
| CreateCircleFlow | Next (step 1)    | CreateCircleFlow.tsx:401 | `disabled={step === 1 && !formData.name}` | Add `title`/aria hint: “Enter circle name”. |

---

## 4) DUPLICATE PAGES AND MERGE RECOMMENDATIONS

### Group A: Explore vs Discovery

- **Explore** (inline in App.tsx): Blog tab + Creators + Projects.
- **Discovery** (DiscoveryPage.tsx): Creators + Projects with filters and EmptyState.
- **Recommendation:** Treat **Explore** as canonical “Discover” entry. Either (1) merge Discovery’s filter grid into Explore and remove Discovery from nav, or (2) keep both but rename: “Explore” = Blog + discovery, “Discovery” = “Find Creators & Projects” and link Explore’s creator/project tabs to same content as Discovery. Prefer single “Discover” surface with tabs (Blog / Creators / Projects) and one nav item.

### Group B: Public profile pages (3 nav items, 2 components)

- **publicCreator** → PublicStandalonePage (individual).  
- **publicProject** → PublicStandalonePage (project).  
- **publicCompany** → PublicProfileDemo (company).
- **Recommendation:** Keep three nav items; they are distinct types. Unify under one component (e.g. PublicStandalonePage) with `profileType`: individual | project | company, and retire PublicProfileDemo for company in favor of that. Then one “Public page” component, three nav labels: “Creator Link Page”, “Project Link Page”, “Company Link Page”.

### Group C: Pricing

- **pricing** → PricingPage.  
- **pricingRefined** → PricingPageRefined (in nav as “Pricing”).
- **Recommendation:** Canonical = **pricingRefined**. Remove `pricing` from router or redirect it to the same UI (e.g. render PricingPageRefined for both). Single nav item: “Pricing”.

### Group D: Monetization showcases

- **monetizationShowcase** (Monetization Hub).  
- **monetizationFlowShowcase** (Flow Showcase).
- **Recommendation:** Keep both if they serve different demos; otherwise merge into one “Monetization” page with tabs. Ensure nav labels are distinct: “Monetization Hub” vs “Flow Showcase”.

### Group E: Calendars

- **calendar** → CalendarPage (in nav).  
- **calendarRefined** → CalendarRefined.  
- **enhancedCalendar** → EnhancedCalendarPage.
- **Recommendation:** Canonical = **calendar** (only one in nav). Use a single calendar component for launch; hide or remove calendarRefined and enhancedCalendar from router until needed. No nav changes.

### Group F: Profile views (dashboard vs profile vs userProfile)

- **profile** = ProfilePage (my profile/settings style).  
- **userProfile** = UserProfilePage (view as user).  
- **creatorProfile** / **brandProfile** / **agencyProfile** = demo profile types.
- **Recommendation:** Keep as is. Ensure “Public Profile” (profile) and “Creator Profile” are clearly labeled so “Public Profile” = my editable public view and Creator/Brand/Agency = demo templates.

---

## 5) REPEATED STRINGS AND EMPTY STATES (Prompt 2)

### A) Top repeated strings

| String / pattern        | File(s):line(s) |
|-------------------------|------------------|
| “Coming Soon”           | LandingPage.tsx:635, 646; AnalyticsPage.tsx:906; PrivacyDataPage.tsx:246, 276 |
| “Placeholder” (in UI)   | HostDashboard.tsx:220, 224, 662, 869, 1050, 1340; CreatorProfileDemo.tsx:305, 318, 332; KOLComponents.tsx:232, 301; BillingPage.tsx:196, 253; EnhancedCalendarPage.tsx:107, 119, 386, 459; LockedFeatureModal.tsx:141; AvailabilitySettings.tsx:207 |
| “placeholder...” (section) | CreatorProfileDemo.tsx:305, 318, 332 |
| “Demo” (data/comments)  | Multiple files (demo data); DashboardPage.tsx:653 (badge “Demo”) |
| “(Placeholder)” in alerts | HostDashboard.tsx:220, 224, 1340; EnhancedCalendar.tsx:107, 119 |

### B) Candidate duplicates (pages / components)

- **Explore vs Discovery** — same “creators + projects” content; different layout/filters. Merge or single “Discover” with tabs.
- **PricingPage vs PricingPageRefined** — two pricing UIs; use PricingPageRefined only.
- **PublicStandalonePage vs PublicProfileDemo** — public company uses PublicProfileDemo; others use PublicStandalonePage. Unify to one component with type.
- **CalendarPage / CalendarRefined / EnhancedCalendarPage** — three calendar views; one canonical (Calendar) in nav.

### C) Plan: shared EmptyState and “Coming soon” pattern

- **EmptyState** already exists: `SharedComponents.tsx` (`EmptyState`). Used in DiscoveryPage and ComponentShowcase. Reuse everywhere a list/section is empty (e.g. “No links yet”, “No events”, “No wallets”).
- **Coming soon / Placeholder:** Add a small shared component (e.g. `StatusBadge` or `ComingSoonBlock`) and use it wherever we show “Coming soon”, “Placeholder”, or “Locked” so copy is consistent and one place to change later.

### D) Shared component and patches

- See below: **Launch polish patches** (shared `StatusBadge` / `ComingSoonBlock`, then replace repeated “Coming soon” / “Placeholder” in key files).
- EmptyState: keep using `EmptyState` from SharedComponents; add usage in Link3Components (“No links yet”), CalendarPage (“No events”), and [username] page (“No wallets”) with consistent copy.

---

## 6) LAUNCH POLISH PATCHES

### 6.1 Redirect duplicate route (pricing → pricingRefined)

In `App.tsx`, render the same component for both so “pricing” is effectively an alias:

- Already: `{route.name === "pricing" && <PricingPage setRoute={setRoute} />}` and `{route.name === "pricingRefined" && <PricingPageRefined setRoute={setRoute} />}`.
- **Patch:** Change to: when `route.name === "pricing"`, render `PricingPageRefined` (same as pricingRefined). Then you can remove PricingPage from imports and router if desired, or keep for any direct setRoute({ name: "pricing" }).

### 6.2 Shared status badge / coming-soon component

**Done.** Added `StatusBadge` to `apps/web/src/figma/app/components/SharedComponents.tsx`. Use `StatusBadge status="coming-soon"` (or `"live"` | `"beta"`). Replaced raw “Coming Soon” in:
- `LandingPage.tsx` — YouTube and TikTok analytics headings
- `AnalyticsPage.tsx` — YouTube/TikTok analytics block
- `PrivacyDataPage.tsx` — YouTube and TikTok integration cards

### 6.3 Remove dead routes from nav (or add stubs)

- **Preferences / Support / Sign Out:** Either remove from sidebar until implemented, or add stub routes (e.g. `preferences`, `support`) that render a simple “Coming soon” page with roadmap text. Sign Out: call auth sign-out when available; until then, stub with “Sign out coming soon.”
- **Upgrade Now:** Wire to `setRoute({ name: "pricingRefined" })` so it goes to Pricing.

### 6.4 Wire Topbar Search and Bell

- **Search:** Either open a global search modal (e.g. reuse GlobalSearch) on focus/click, or add ⌘K command palette that sets route or opens search. Minimal fix: `onClick` on the search container to `setRoute({ name: "discovery" })` or open a search overlay.
- **Bell:** Add `onClick={() => setRoute({ name: "notifications" })}` and add a simple Notifications stub page (“No notifications yet” + roadmap).

### 6.5 Ensure every page has content or CTA

- **verificationInbox** and **showcase**: Not in nav; either add nav entries (e.g. “Verification Inbox” under Verification, “Component Showcase” in dev only) or leave as dev-only routes. For launch, ensure Verification Center has a clear CTA to “Inbox” if that’s the main flow.
- **Orphan calendars** (calendarRefined, enhancedCalendar): No nav; OK to leave in codebase but not linked. No patch required for launch.

---

## 7) FILE REFERENCE SUMMARY

| Purpose              | File path |
|----------------------|-----------|
| App shell + routing  | `apps/web/src/figma/app/App.tsx` |
| Next.js routes       | `apps/web/src/app/**/page.tsx` |
| Sidebar nav          | `apps/web/src/figma/app/App.tsx` (Sidebar) |
| Topbar               | `apps/web/src/figma/app/App.tsx` (Topbar) |
| EmptyState           | `apps/web/src/figma/app/components/SharedComponents.tsx` |
| Landing “Coming soon” | `apps/web/src/figma/app/components/LandingPage.tsx` |
| Analytics “Coming soon” | `apps/web/src/figma/app/components/AnalyticsPage.tsx` |
| Privacy “Coming soon”  | `apps/web/src/figma/app/components/PrivacyDataPage.tsx` |
| Public pages         | `PublicStandalonePage.tsx`, `PublicProfileDemo.tsx` |
| Pricing              | `PricingPage.tsx`, `PricingPageRefined.tsx` |

---

**Audit complete.** Apply patches in 6.1–6.5 for redirect consistency, shared status badge, dead nav fixes, and search/bell behavior. Use the duplicate/merge recommendations in section 4 to consolidate before or post-launch.
