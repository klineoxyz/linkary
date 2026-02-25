# Phase 2 — UI/UX & Design System Audit

**Audit type:** Design systems, contrast, theming, responsiveness  
**Ownership:** Design Systems Lead (ex-Apple/Airbnb) + Staff Engineer  
**Scope:** Typography contrast, dark tokens on light shell, component consistency, mobile.

---

## 1. Typography Contrast on Light Surfaces

### 1.1 Root shell

- **App shell:** `bg-[#F7F8FB] text-gray-900` (light gray-blue background; dark text).  
- **Main:** `font-app text-base antialiased`; GlobalStyles apply `font-family` and `-webkit-font-smoothing: antialiased`.  
- **Verdict:** Root text color is sufficient for body copy. Past issues were localized to **cards and components** that used **dark-theme tokens** (white/opacity) on this light shell.

### 1.2 Resolved (recent work)

- Profile (Overview + Insights) and profile-dashboard cards now support **`variant="light"`** when used on the profile/insights page: `text-foreground`, `border-border`, `bg-card`, `bg-secondary`, `font-medium`/`font-semibold`.  
- ProfileHeaderCard, ScoreCard, TopFollowersCard, SocialGraphCard, AffiliatedAccountsCard, RecommendedAccountsCard, EmptyStateCard all have light variant; InsightsTab passes `variant="light"`.  
- “Copy link” and other header/button text on Insights use solid foreground.  
- **Remaining risk:** Any **other** route that still renders components with dark-only styling (e.g. Dashboard, Analytics, Org detail) on the same light shell will have contrast issues until those components also support `variant="light"` or the shell is scoped per-route.

---

## 2. Inconsistent Use of Dark Tokens on Light Shell

### 2.1 Pattern

- **Dark tokens:** `text-white`, `text-white/60`, `text-white/70`, `border-white/10`, `bg-white/5`, `bg-white/10`, `from-white/8`, `to-white/[0.03]`.  
- When these are used on **light** backgrounds (`#F7F8FB`, white cards), text and borders become low-contrast or invisible.

### 2.2 Components still using dark tokens (candidate list)

*Files that still contain `text-white/`, `border-white/`, `bg-white/` in figma app/components (excluding typography.css and profile-dashboard cards already given light variant):*

| File | Notes |
|------|--------|
| `App.tsx` | Multiple: overview cards, featured events/creators/projects, marketplace, messages, modals (white/20, white/30, etc.). |
| `AnalyticsPage.tsx` | ~46 occurrences: KPIs, signals, top drivers, baseline, tabs, buttons. |
| `AnalyticsTabContent.tsx` | Charts, init status, backfill CTA, tooltips. |
| `DashboardPage.tsx` | Stat cards, brand cards, charts, search, deal list. |
| `SharedComponents.tsx` | GlassCard, StatCard, badges, section headers (~63). |
| `PrivacyDataPage.tsx` | Toggles, sections. |
| `VerificationCenterPage.tsx` | Claims, records. |
| `VerificationInboxPage.tsx` | Request list, filters. |
| `Link3Components.tsx` | Buttons, cards. |
| `ReputationCardGenerator.tsx` | Cards, CTAs. |
| `CalendarPage.tsx` | Calendar UI. |
| `XSpacesPage.tsx` | Spaces list. |
| `UnifiedProfileLayout.tsx` | Profile shell. |
| `ProfileDashboardPage.tsx` | Legacy dashboard (if still used). |
| `GlobalSearch.tsx` | Search overlay. |
| `DailyDropBanner.tsx` | Banner. |
| `CreatorProfileDemo.tsx`, `CreatorProfilePage.tsx` | Demo/detail. |
| `BrandProfilePage.tsx`, `AgencyProfilePage.tsx` | Brand/agency. |
| `UserProfilePage.tsx` | Other-user profile. |
| `profile-dashboard/ProfileHeaderCard.tsx` | Has light variant; dark still default. |
| `profile-dashboard/ScoreCard.tsx` | Has light variant; dark still default. |
| `profile-dashboard/TopFollowersCard.tsx` | Has light variant; dark still default. |
| `profile-dashboard/SocialGraphCard.tsx` | Has light variant; dark still default. |
| `profile-dashboard/AffiliatedAccountsCard.tsx` | Has light variant; dark still default. |
| `profile-dashboard/RecommendedAccountsCard.tsx` | Has light variant; dark still default. |
| `profile-dashboard/EmptyStateCard.tsx` | Has light variant; dark still default. |
| `profile-dashboard/AccountFeedCard.tsx` | No light variant yet. |
| `profile-dashboard/MentionsCard.tsx` | No light variant yet. |
| `FlipCard.tsx`, `ReputationLevelBar.tsx` | Shared. |

*Counts from grep: 20+ files with `text-white/`, `border-white/`, or `bg-white/` in figma.*

---

## 3. Surface Theming System: `variant="light" | "dark"`

### 3.1 Current state

- **Profile + Insights:** Cards accept `variant="light"` and render with `text-foreground`, `border-border`, `bg-card`, `bg-secondary`, `bg-muted`.  
- **Theme (theme.css):** Defines `--foreground`, `--muted-foreground`, `--border`, `--card`, etc.; light mode uses `#130600` for foreground.  
- **Gap:** Dashboard, Analytics, Org detail, and other routes still render components that assume dark surfaces. There is **no global “surface”** (e.g. `data-theme="light"` on body) that components read from; each component is passed `variant` explicitly where implemented.

### 3.2 Recommendation

- **Option A (recommended for v1):** Treat the **entire app shell as light** and systematically add `variant="light"` (or equivalent) to every card/panel used on Dashboard, Analytics, Org, and shared components. Remove or reduce reliance on dark-only styling.  
- **Option B:** Introduce a **surface context** (e.g. React context or `data-surface="light"|"dark"` on a wrapper) and have components derive variant from it; then set surface per route (e.g. profile/dashboard/analytics/org = light).  
- **Option C:** Keep dark surfaces only for dedicated “dark” routes (e.g. a future “focus mode” or embed); default = light.  
- **Card system:** Standardize on a single **Card** that accepts `variant` and uses design tokens (`border-border`, `bg-card`, `text-foreground`, etc.) so no card uses raw `border-white/10` or `bg-white/5` without a variant.

---

## 4. Standardization: Cards, CTAs, Empty / Error / Rate-limit / Permission States

### 4.1 Card system

- **Current:** Mix of `GlassCard`, `StatCard`, local `Card` (shadcn/ui?), and ad-hoc `rounded-2xl border ...` divs. Some use `border-white/10 bg-gradient-to-br from-white/8`, others `border-border bg-card`.  
- **Recommendation:** One **Card** primitive with `variant="light"|"dark"` (default light). No gradient borders on light; use `border-border bg-card shadow-sm`. Dark variant can keep current glass style for future use.

### 4.2 CTA hierarchy

- Primary: `bg-primary text-primary-foreground`.  
- Secondary: `border-border bg-secondary text-foreground` (or outline).  
- Ensure all CTAs on light surfaces use `text-foreground` or `text-primary`, not `text-white` or `text-white/80`.

### 4.3 Empty states

- Use **EmptyStateCard** (or shared component) with `variant` and consistent icon + title + message + optional CTA.  
- Text: `text-foreground`, `font-medium` / `font-semibold` on light.

### 4.4 Error / rate-limit / permission states

- **Analytics init failed banner:** Already uses amber (visible).  
- **Rate limit:** Show clear message + “Try again after {time}” and disable retry until then.  
- **Permission / blocked:** When cross-user view is restricted, show a single “Not available” or “Sign in to view” state with consistent styling (foreground text, no white/opacity).

---

## 5. Mobile Responsiveness

### 5.1 Audit points

- **Dashboard:** Grids (brands, deals, charts); sidebar collapses to mobile menu; tables/lists must stack or scroll. Recharts containers use `ResponsiveContainer`; ensure min heights and font sizes are readable on small screens.  
- **Profile:** Two-column layout (avatar + meta | content) should stack on small viewports; tabs (Overview | Insights) already flex; cards stack.  
- **Analytics:** Dense KPIs and tables; ensure horizontal scroll or stacking for “top drivers” and charts; init status and backfill CTA accessible.  
- **Org detail:** Tabs and content; same stacking rules.  
- **Charts & grids:** Recharts in Dashboard and SocialGraphCard need `ResponsiveContainer` and touch-friendly hit areas; legend and axis labels should not overflow.

### 5.2 Recommendation

- Audit each of Dashboard, Profile, Analytics, Org at 320px and 375px width.  
- Use a single **breakpoint strategy** (e.g. Tailwind `sm`/`md`/`lg`) for nav, grids, and padding.  
- Ensure no critical CTA or key metric is hidden or unreadable on mobile.

---

## 6. Inconsistent Component List (with file paths)

| Priority | Path | Issue |
|----------|------|--------|
| P0 | `apps/web/src/figma/app/components/AnalyticsPage.tsx` | Dark tokens throughout; needs light variant or light-by-default. |
| P0 | `apps/web/src/figma/app/components/AnalyticsTabContent.tsx` | Same. |
| P0 | `apps/web/src/figma/app/components/DashboardPage.tsx` | Dark tokens in stat cards, brand cards, charts area. |
| P0 | `apps/web/src/figma/app/components/SharedComponents.tsx` | GlassCard, StatCard, etc. used by multiple pages. |
| P1 | `apps/web/src/figma/app/App.tsx` | Overview section (featured events, creators, projects, marketplace) uses white/20, black/20, inline styles. |
| P1 | `apps/web/src/figma/app/components/OrgDetailPage.tsx` | Org insights tab and layout. |
| P1 | `apps/web/src/figma/app/components/PrivacyDataPage.tsx` | Sections and toggles. |
| P1 | `apps/web/src/figma/app/components/VerificationCenterPage.tsx`, `VerificationInboxPage.tsx` | Lists and filters. |
| P2 | `Link3Components.tsx`, `ReputationCardGenerator.tsx`, `CalendarPage.tsx`, `XSpacesPage.tsx` | Buttons and cards. |
| P2 | `GlobalSearch.tsx`, `DailyDropBanner.tsx` | Overlay and banner. |
| P2 | `profile-dashboard/AccountFeedCard.tsx`, `MentionsCard.tsx` | No light variant. |

---

## 7. Refactor Plan

| Priority | Action |
|----------|--------|
| **P0** | Add `variant="light"` (or light-by-default) to AnalyticsPage and AnalyticsTabContent; ensure all text and borders use design tokens on light. |
| **P0** | Same for DashboardPage: cards and charts container use `variant="light"` and tokens. |
| **P0** | Refactor SharedComponents (GlassCard, StatCard, etc.) to accept `variant` and use `text-foreground`, `border-border`, `bg-card` when light. |
| **P1** | App.tsx Overview: replace inline `style={{ color: ... }}` and white/black opacity with Tailwind tokens; ensure featured events/creators/projects and marketplace are readable. |
| **P1** | OrgDetailPage: insights tab and any cards use light variant. |
| **P1** | PrivacyDataPage, VerificationCenterPage, VerificationInboxPage: consistent tokens. |
| **P2** | Link3Components, ReputationCardGenerator, CalendarPage, XSpacesPage, GlobalSearch, DailyDropBanner: tokens + variant where needed. |
| **P2** | AccountFeedCard, MentionsCard: add light variant if still used on light routes. |
| **P2** | Mobile pass: Dashboard, Profile, Analytics, Org at 320/375px; fix overflow and tap targets. |

---

## 8. Summary

- **Contrast:** Resolved for Profile + Insights via `variant="light"`. Dashboard, Analytics, and shared components still use dark tokens on the light shell and need the same treatment.  
- **Theming:** Standardize on **light as default** and a single **Card** (and shared components) with `variant="light"|"dark"` using design tokens.  
- **Consistency:** One list of files and a P0/P1/P2 refactor plan above.  
- **Mobile:** Audit key routes and Recharts usage; document breakpoints and fix overflow/readability.
