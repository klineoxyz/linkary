# Linkary MVP Frontend Audit

**Purpose:** Identify which MVP flows already have UI (and how they’re wired) vs what must be built or connected to the backend.  
**Scope:** `apps/web/src/figma/app/` (App.tsx and components). No styling refactors.  
**Date:** 2026-02-18

---

## 1) MVP flows – UI existence and wiring

| Feature | UI exists? | Route(s) | Component / location | API / backend? | Missing pieces |
|--------|------------|----------|----------------------|----------------|----------------|
| **Signup / login** | No | — | No signup/login screens in figma app. Reserved usernames in `[username]/page.tsx`: `login`, `onboarding`. | N/A | Add `/login`, `/onboarding` (or in-app routes); wire to auth (Supabase). |
| **Onboarding** | No | — | Not implemented. | N/A | First-run flow: Creator vs Brand vs Both, handle + profile basics. |
| **Create / edit profile** | Partial | `profile` | **ProfilePage** (App.tsx inline). Edit = nav to same page; Add/Add New/Leave Review/Share/Connect → comingSoon. No form to edit handle, name, bio, avatar. | No | Profile edit form; PATCH profile API; optional publish toggle. |
| **Publish public profile** | Partial | `profile`, `[username]` | **ProfilePage** shows `linkary.xyz/${handle}` (demo). Real public page = **Next.js** `app/[username]/page.tsx` (reads from Supabase `getProfileByUsername`, `getWalletsByUserId`). | Yes (Supabase) | In-app “Publish” action and route; ensure profile data flows from auth user. |
| **Public profile page (view)** | Yes | `/[username]` (Next.js) | `apps/web/src/app/[username]/page.tsx` – server component, DB-driven. In-app “view” demos: `userProfile`, `publicCreator`, `publicProject`, `publicCompany` (demo data). | Yes for `[username]` | None for view. In-app demos stay demo until backend. |
| **Create brand / project** | No | `dashboard` | **DashboardPage**: `showCreateBrand` state exists but is never used (no modal/form). “Create brand” on UserProfilePage → navigates to dashboard. | No | Create brand form (slug, name, tagline, etc.); POST org API; optional invite flow. |
| **Brand profile page (view)** | Yes (demo) | `brandProfile` | **BrandProfilePage** (components/BrandProfilePage.tsx). Demo data, no API. | No | Wire to GET org by slug; edit brand flow. |
| **Create job / sprint** | No | — | Marketplace shows jobs/sprints from `demo.marketplace`. No “Post job” or “Create sprint” form in nav or dashboard. | No | Post job/sprint form; POST jobs API; brand context. |
| **Apply to job / sprint** | UI only | `market` | **MarketplacePage** (App.tsx). “Apply” buttons → `comingSoon`. Job/sprint cards show applicants count (demo). | No | Application form (cover, etc.); POST applications; conversation creation. |
| **Applicant list view** | Demo only | — | **MarketplacePage**: “AI Suggested Candidates” per job (demo). No brand-side “View applicants” screen. | No | Brand view: list applications by job; PATCH status; messaging entry. |
| **Messaging UI** | Yes (static) | `messages` | **MessagesPage** (App.tsx). Conversation list + open thread (MatrixPay) + input. Send → comingSoon. View Profile → brandProfile. | No | Wire to GET conversations, GET messages, POST message; unread counts. |
| **Reviews (display)** | Yes (demo) | Multiple | ProfilePage, UserProfilePage, BrandProfilePage, etc. show `reviews.items`, stars, “Leave Review” → comingSoon. | No | Leave-review form (rating, text, deal picker); POST reviews; GET reviews by profile/org. |
| **Reviews (create)** | No | — | “Leave Review” buttons → comingSoon. No create-review form. | No | Form + POST review; deal-verified rule in backend. |
| **Verification center UI** | Yes (mock) | `verification` | **VerificationCenterPage** (VerificationCenterPage.tsx). Pending/verified claims lists, mock data. Actions (verify/decline) are local state only. | No | Wire to GET claims, PATCH claim status; optional inbox link. |
| **Verification inbox** | Yes (mock) | `verificationInbox` | **VerificationInboxPage** (VerificationInboxPage.tsx). Mock verification requests; accept/decline local only. | No | GET verification requests; PATCH status. |
| **Privacy & data settings** | Yes (local state) | `privacy` | **PrivacyDataPage** (PrivacyDataPage.tsx). Toggles for analytics visibility and connected accounts (Twitter/YouTube/TikTok). Local state only. | No | Persist settings (API or Supabase); enforce in analytics. |
| **Analytics UI** | Yes (mock) | `analytics` | **AnalyticsPage** (AnalyticsPage.tsx). X KPIs, sparklines, mock data. YouTube/TikTok → “Coming soon”. | No | Event tracking API; aggregate counts; wire dashboard to real or estimated data. |
| **Discover / Explore** | Yes (demo) | `explore`, `discovery` | **ExplorePage** (App.tsx). Blog + Creators + Projects tabs, search, filters (min ETHOS/XScore). Connect/Join/View → comingSoon or setRoute. | No | Search/filter backed by API; creator/project cards from API. |

---

## 2) Per-flow detail

### Signup / login
- **Screens:** None in figma app. Landing has “Sign up to get notified” (marketing). PublicStandaloneProfile has optional “Login” button (callback).
- **Routes:** No `login` or `onboarding` page in app router (only reserved in `[username]`).
- **API:** None. Supabase auth exists (test-supabase, PublicProfilePage session, WalletsSection).

### Onboarding
- **UI:** None. No “I’m a Creator / Brand / Both” or handle/profile setup flow.
- **API:** None. `profiles.onboarding_completed_at` exists in DB types.

### Create / edit profile
- **UI:** ProfilePage shows `linkary.xyz/${handle}` and sections (featured work, events, case studies, reviews). Buttons: Share, Connect, Add, Add New, View, Leave Review → comingSoon or nav. No form for handle, display name, bio, avatar.
- **Route:** `profile` (My Profile).
- **API:** None. Need PATCH profile and optionally GET me.

### Publish public profile
- **UI:** No explicit “Publish” toggle. Public URL is implied by having a profile in DB; `[username]` is server-rendered from Supabase.
- **API:** Profile create/update; optional “published” flag if you gate public visibility.

### Create brand
- **UI:** DashboardPage has `showCreateBrand` state but no modal or form. UserProfilePage “Create brand” → setRoute dashboard. No brand creation form anywhere.
- **Route:** `dashboard`.
- **API:** POST org; org_members (owner).

### Create job / sprint
- **UI:** None. No “Post job” or “Create sprint” in sidebar or dashboard.
- **API:** POST jobs (and job type or kind for sprint vs job).

### Apply to job / sprint
- **UI:** MarketplacePage: job/sprint cards with “Apply” → comingSoon. No application form.
- **API:** POST applications; optionally create conversation.

### Applicant list
- **UI:** Only “AI Suggested Candidates” per job (demo list). No brand view of “Applications for this job”.
- **API:** GET jobs/:id/applications; PATCH application status.

### Messaging
- **UI:** MessagesPage: conversation list (static), one thread (MatrixPay), input. Send → comingSoon. View Profile → brandProfile.
- **API:** GET conversations, GET conversations/:id/messages, POST messages; unread counts.

### Reviews (create)
- **UI:** “Leave Review” on ProfilePage → comingSoon. No form.
- **API:** POST reviews (with dealId when verified); GET profile/org reviews.

### Reviews (display)
- **UI:** Multiple pages show review lists and stars (demo data). No API.
- **API:** GET profiles/:handle/reviews, GET orgs/:slug/reviews.

### Verification center / inbox
- **UI:** Full mock UIs; actions are local state.
- **API:** GET claims/requests; PATCH status (verify/decline).

### Privacy & data
- **UI:** Toggles and “Coming soon” for YouTube/TikTok. Local state only.
- **API:** Save settings (user or profile settings table).

### Analytics
- **UI:** Full dashboard with mock KPIs and time range. No API.
- **API:** POST events/track or store counts; GET aggregated metrics.

---

## 3) Buttons still wired to Coming Soon (or stub)

| Location | Button / action | Current behavior |
|----------|-----------------|------------------|
| ProfilePage | Share, Connect | comingSoon |
| ProfilePage | Add (featured work), Add New (case study), View (case study), Leave Review | comingSoon |
| UserProfilePage | Share | comingSoon |
| UserProfilePage | Edit Profile | setRoute profile |
| UserProfilePage | Create brand | setRoute dashboard |
| MarketplacePage | Apply (job/sprint) | comingSoon |
| MessagesPage | Send message | comingSoon |
| ExplorePage | Write Article, Connect, Join (event), View (project) | comingSoon or setRoute |
| DashboardPage | Create brand | showCreateBrand state never used; no form |
| Various | Upgrade Plan, Filters (now panel), etc. | See UI_FUNCTIONAL_AUDIT |

---

## 4) Required backend endpoints (MVP)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout` | Or use Supabase Auth directly; ensure web uses anon + session. |
| Me | `GET /me` or Supabase `auth.getUser()` + profile | Current user + profile for nav and edit. |
| Profiles | `POST /profiles`, `PATCH /profiles/:id`, `GET /profiles/:handle`, `POST /profiles/:id/publish` (optional) | Create/update profile; public profile by handle; optional publish. |
| Orgs | `POST /orgs`, `PATCH /orgs/:id`, `GET /orgs/:slug`, `GET /orgs` (mine) | Create/edit brand; public org page; list my orgs. |
| Jobs | `POST /jobs`, `PATCH /jobs/:id`, `GET /jobs`, `GET /jobs/:id` | Create job/sprint; update status; list; detail. |
| Applications | `POST /applications`, `GET /jobs/:id/applications`, `PATCH /applications/:id` | Apply; list applicants; update status. |
| Conversations | `POST /conversations`, `GET /conversations`, `GET /conversations/:id/messages`, `POST /messages` | Start thread; list; messages; send. |
| Deals | `POST /deals`, `PATCH /deals/:id/status` | Create deal (e.g. when brand marks completed); update status. |
| Reviews | `POST /reviews`, `GET /profiles/:handle/reviews`, `GET /orgs/:slug/reviews` | Create review; list by profile/org. |
| Verification | `GET /claims` (or inbox), `PATCH /claims/:id` | List claims/requests; verify/decline. |
| Settings | `GET /settings`, `PATCH /settings` (or profile flags) | Privacy/analytics toggles. |
| Analytics | `POST /events/track` (optional), `GET /analytics` or counts | Clicks, views; optional time series. |

---

## 5) Required DB tables (MVP)

| Table | Purpose |
|-------|---------|
| **users** | If not using Supabase auth.users only; else extend with app roles. |
| **profiles** | Already in use (`getProfileByUsername`). Add/align fields: handle, display_name, bio, avatar_url, website, onboarding_completed_at, published, etc. |
| **wallets** | In use. Keep RLS and optional `get_public_wallets`. |
| **orgs** | Brands/projects: slug, name, tagline, logo, website, owner_id, etc. |
| **org_members** | owner/admin/member per org. |
| **jobs** | title, org_id, type (job/sprint), budget, duration, requirements, status. |
| **applications** | job_id, applicant_id (profile), status, message, created_at. |
| **conversations** | participant ids (user/org or two users). |
| **messages** | conversation_id, sender_id, body, created_at. |
| **deals** | Links creator + org + job/application; status; amount optional. |
| **reviews** | reviewer, reviewee (profile or org), rating, title, text, deal_id (optional), verified_deal. |
| **verification_claims** (or similar) | type, claimant, recipient, status, details. |
| **analytics_events** or **profile_counts** | Optional: event log or simple counters (views, clicks). |

---

## 6) Summary

- **Already in place (UI):** Public profile URL `[username]` (DB-backed), Explore (demo), Jobs & Sprints list (demo), Messaging layout (static), Reviews display (demo), Verification center/inbox (mock), Privacy toggles (local), Analytics dashboard (mock), Profile/Brand view pages (demo).
- **Missing or coming-soon:** Signup/login screens, onboarding, profile edit form, publish control, create brand form, create job/sprint form, apply form, applicant list for brands, real messaging send/receive, leave-review form, verification actions persisted, privacy/analytics persisted, analytics tracking.
- **Backend:** Supabase used for profiles and wallets. Remaining work: auth flow exposure in UI, orgs/jobs/applications/conversations/messages/deals/reviews/verification/settings (and optional analytics).

Use this table and the endpoint/table lists to implement backend and then wire each UI flow (replace demo data and comingSoon where appropriate).
