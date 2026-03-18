# Linkary — current-state product truth map

**Purpose:** Plain-language map of how the product works *today* (from code + docs). For strategy, IA, and simplification — not a spec for rewrites.

---

## Executive summary

**Linkary (linkary.xyz)** is a **creator/brand network**: public profiles, reputation, X-linked analytics (stored snapshots), org workspaces (jobs, sourcing, programs), marketplace (jobs/sprints/programs), messaging, circles/KOL lists, and deals. **Authority for org actions comes from `org_members`**, not profile type alone.

**CRM (crm.linkary.xyz)** is a **separate Next.js app** on the same Supabase project. It holds **operational execution**: personal task boards for creators, **campaign** boards for orgs, submissions, reports. Work **syncs from Linkary** when a creator accepts a gig/sprint (idempotent API). CRM uses **`crm_*` tables**; it does not replace Linkary’s jobs/deals — it **extends** them into tasks and campaign workflow.

**Main tension for users:** three “places” — **main app** (identity + discovery + org ops), **public profile** (what the world sees), **CRM** (delivery after you’re in a deal). Plus **personal vs org mode** in the main app (active context).

---

## 1. Current product operating map

### What Linkary is today

A platform where **individuals** build a **verifiable public presence** (profile, case studies, gigs, reviews) and **orgs** (brands, projects, agencies) run **hiring/sourcing** (jobs, sprints, creator programs, pipeline). **Analytics** for your own X account are **stored metrics** in-app (not live scraping on every page load). **Cross-user** analytics/insights are **limited** (snapshot or allowlisted aggregates), gated by product rules.

### Main modules (linkary.xyz)

| Module | Role |
|--------|------|
| **Auth & onboarding** | X-first login, invite gate when enabled, account type (individual/company), professions. |
| **Personal shell** | Dashboard, profile (private workspace), profile edit, analytics, settings, deals (gigs), applications, inbox/requests, explore/discovery, market, messages, circles, watchlist, etc. |
| **Org workspace** | Per-org: dashboard tab, insights, members, affiliates, ambassadors, jobs, **sourcing** pipeline, case studies, settings. Access = **org member** (`org_members`). |
| **Public web** | `/{username}` public profile (published view); unpublished/owner flows. |
| **APIs** | Jobs, deals, invites, analytics, CRM sync trigger, etc. |

### What lives where

| Surface | Host | Data / app |
|---------|------|------------|
| **linkary.xyz** | `apps/web` | `profiles`, `orgs`, `org_members`, `jobs`, `deals`, `gigs`, analytics cache tables, sourcing, invites, etc. |
| **crm.linkary.xyz** | `apps/crm` | `crm_*` tables: workspaces, campaigns, tasks, bundles, submissions, reports. Linked to Linkary orgs via `crm_workspaces.linked_org_id`. |

Same **Supabase Auth**; shared session if cookie domain is set (e.g. `.linkary.xyz`).

### Main user types

| User | Can do (high level) |
|------|---------------------|
| **Individual creator** | Public profile, edit profile, own analytics, apply to jobs/sprints, gig deals, org **job/program invites** inbox, personal CRM **tasks** after sync, circles, discovery. |
| **Org member (admin/member)** | Org workspace: jobs, sourcing, programs, members, etc. Actions gated by **org role** in `org_members`. |
| **Visitor** | Public profiles, some discovery; no private data. |

---

## 2. Surface-by-surface map

| Surface | For | Purpose | Data / ownership | Typical actions | Public? | Redundant / confusing |
|---------|-----|---------|------------------|-----------------|---------|-------------------------|
| **`/onboarding`** | New users | Invite (if required) → role → professions → app. | Writes `account_type`, professions, `onboarding_completed_at`. | Complete steps. | Private. | Overlaps mentally with “profile completion” later. |
| **`/app/dashboard`** | Signed-in user | Personal hub: orgs list, stats hooks, **next steps** for launch. | Deals/me-stats driven; org list from membership. | Create org, jump to analytics/profile. | Private. | vs **Overview** — both “home-ish”. |
| **`/app/profile`** | Owner | **Private** workspace: overview, case studies, links, relations, **public preview** tab. | Profile + related entities; mirrors what can go public. | Edit via links, preview `/{slug}`. | **Private** (only you). | Many CTAs (Analytics vs Quick snapshot vs Public preview). |
| **`/app/profile/edit`** | Owner | **Advanced editor** for fields that feed **public** page. | `profiles`, links, skills, hero, gigs, etc. | Save → public updates (published). | Edits are private; **output** is public when published. | Name “edit” vs “profile” — two profile surfaces. |
| **`/app/analytics`** | Owner | **Your** X analytics (windows, KPIs, charts) from **stored** data. | `x_*` aggregates, snapshots; refresh queues worker. | Change window, request refresh. | **Private.** | vs **Quick snapshot** / insights — both X-themed; different depth. |
| **`/app/analytics/profile/[user]`** | Eligible signed-in viewer | **Cross-user analytics** page (`CrossUserAnalyticsPage`); API `GET /api/me/analytics/profile/[username]`. | Allowlisted/snapshot payload; not full owner charts. | View only; rate limited. | **Not** public; gated in-app. | Overlaps with **`/app/u/[user]/insights`** (`InsightsSnapshotLazy`) — two URLs for “someone else’s X snapshot”. |
| **`/[username]`** | Everyone | **Public** published profile. | `public_profile_view` + public sections. | View, collab, apply to gig, etc. | **Public** (if published). | vs logged-in profile — easy to confuse “my page” vs “edit”. |
| **Org workspace** (`/org/{slug}` tabs) | Org members | Operate as **brand**: jobs, sourcing, members, programs, etc. | Org-scoped tables; **RLS + org_members**. | Post jobs, move sourcing cards, invite team. | **Private** org ops. | Heavy tab set; overlaps with **Market** (browse) vs **manage**. |
| **Creator org-invites** (`/app/org-invites`) | Individual creators | Inbox for **job invites** + **program invites** from orgs. | `org_job_invites`, `creator_program_invites`. | Accept/decline/dismiss; apply. | Private. | Separate from **Messages**; separate from **CRM** tasks until deal exists. |
| **CRM `/tasks`** | Individuals (eligible) | **Personal task board** (deliverables), often after sync from Linkary accept. | `crm_tasks`, bundles, workspaces. | Check off work, open task detail. | Private. | Users may not know tasks **appear only after** deal + sync. |
| **CRM `/campaigns`** | Org-side operators | **Campaign** = operational container for participants + tasks. | `crm_campaigns`, participants, bundles. | Manage campaign, review submissions. | Private. | “Campaign” in CRM ≠ “creator program” in Linkary naming (related but different layer). |
| **CRM sourcing** (Linkary app) | Org members | **Pipeline** for creator discovery (org sourcing tab). | Sourcing stages, grounded in org workflow. | Move candidates, extend, etc. | Private. | vs CRM campaigns — sourcing is **pre-deal**; CRM is **post-accept execution**. |

---

## 3. Personal vs org model

### Personal mode

- Cookie/context: **`personal`** (`linkary_active_context`).
- **You** are acting as your **individual profile**: gigs, personal dashboard, personal analytics, creator inbox, circles (personal lists), profile deals.
- Nav is **creator-centric**.

### Org mode

- Cookie/context: **`org:<uuid>`** — only if **`org_members`** says you belong.
- Sidebar/nav **org-first** (indigo): org overview, jobs, marketplace browse, KOL lists **for that org**, team, programs.
- **Gig deals** vs **job deals**: personal profile holds **gig** deals; org flow holds **job** deals (see active-context doc).

### Active context

- **Switcher** in sidebar/top bar: “My profile” vs org name.
- **Invalid org** in cookie → falls back to personal.
- **KOL lists** scope: personal mode may see profile + all orgs’ lists; org mode **only active org’s** lists.

### Where confusion happens

- **Same person** wears creator hat and org hat — context switch is easy to miss.
- **Dashboard** in personal vs **org workspace** “Workspace” tab — both feel like “home”.
- **Market** lists jobs/programs for **browsing**; **org Jobs tab** is **management** — same words, different jobs.

---

## 4. Individual profile vs org vs public page

| Concept | What it is |
|---------|------------|
| **Individual profile (in-app)** | **Private** workspace at `/app/profile` — everything you curate before/at publication. |
| **Org** | A **company/project/agency** entity with **members**, **jobs**, **sourcing**, **programs**. Not the same as a person’s profile. |
| **Public profile page** | `linkary.xyz/{username}` — **visitor-facing** slice of profile data (published). |
| **Editable** | `/app/profile/edit` (+ some actions from profile overview). |
| **Shareable** | Public URL + reputation card, etc. |
| **Analytics** | **Owner**: private app analytics (X windows, refresh). **Not** the public profile page. **Others**: snapshot/allowlisted only. |
| **CRM** | **After** commitment: tasks and campaigns. **Not** where you edit public bio or post a job (that’s main app). |

---

## 5. CRM in simple terms

### What crm.linkary.xyz does

- **Tasks:** Creators see **deliverables** on a board (`/tasks`).
- **Campaigns:** Orgs see **campaigns** with participants and task bundles (`/campaigns`).
- **Submissions / reports:** Operational review and export.
- **Workspaces:** Can link to Linkary **`orgs.id`** so sync from Linkary resolves the right CRM workspace.

### Personal task board

- Eligible **individual** creators get tasks on their **personal** CRM board when Linkary triggers sync (e.g. accepted sprint/gig with deliverables).
- If sync can’t use personal board (e.g. non-individual profile), tasks may land on **org campaign** side per sync rules.

### Campaign work (CRM)

- **Campaign** = container for **participants** (creators) and **tasks** tied to a Linkary job/sprint id (`source_linkary_campaign_id`).
- Org operators track delivery, submissions, reporting **here** — not on the public profile.

### Org sourcing (Linkary app, not CRM)

- **Pipeline** on org detail (**Sourcing** tab): stages, cards, team workflow — **before** or alongside hiring; **grounded** in org sourcing tables/RLS.
- This is **discovery/ops in Linkary**, not the CRM task grid.

### How invites / applications / deals / programs relate

| Concept | Where | Role |
|---------|-------|------|
| **Job invite** | Linkary → creator inbox | Org invites creator to a **job**; creator may apply. |
| **Program invite** | Linkary → creator inbox | Invite into **creator program** (ambassador/affiliate track). |
| **Application** | Linkary | Apply to open job/sprint. |
| **Deal** | Linkary | Accepted collaboration (gig vs job deal by context). |
| **CRM sync** | Linkary → CRM API | After accept, **tasks** appear in CRM; **campaign** upserted. |

### Grounded truth vs operator metadata

- **Grounded truth:** Linkary jobs, deals, org membership, published profile fields, analytics aggregates from stored X data.
- **Operator metadata:** CRM task status, campaign notes, submission review state — **execution layer**; must stay consistent with sync idempotency rules.

---

## 6. Simplification audit

### Duplicated / overlapping concepts

- **Profile / Profile edit / Public preview / Public URL** — four entry points to “how I look”.
- **Analytics vs Insights vs Quick snapshot** — all X/reputation flavored; different depths.
- **Dashboard vs Overview vs Org workspace** — multiple “homes”.
- **Market vs Org jobs** — browse vs manage.
- **Campaign** (CRM) vs **Creator program** (Linkary) vs **Sourcing** — related lifecycle, different names.

### Confusing labels

- “Quick snapshot” vs “Full analytics”.
- “Workspace” (CRM) vs “org workspace” (Linkary).
- **Acting as** org vs viewing **another user’s** profile.

### Overlapping routes

- `/app/profile/*` vs `/app/settings/*` vs `/[username]`.
- **`/app/analytics/profile/[user]`** vs **`/app/u/[user]/insights`** — both viewer-facing “someone else’s insights”; different components.
- Multiple paths to **integrations** (X connect).

### Where users may not know next step

- After onboarding → **profile vs org create** (company users).
- After **invite** → apply vs wait for CRM tasks (sync delay).
- **CRM** entry — not always linked from main app UI (depends on product links).

### Boundary unclear

- **Personal vs org** when user is member of many orgs.
- **Public vs private** analytics (snapshot on public profile vs full charts in app).
- **CRM required?** vs optional for creators who only browse.

---

## 7. Recommended simplified product story (launch)

**What Linkary is:** The place where **creators prove reputation** and **orgs run hiring and programs** — with **public pages** for discovery and **private analytics** for your own growth.

**Who it’s for:** **Creators** (individuals) and **orgs** (brands, projects, agencies).

**Core flows:**

1. **Set up** → onboarding → profile + optional X → public page live.  
2. **Grow** → own analytics (stored) + reputation on profile.  
3. **Work** → apply or get invited → deal on Linkary → **deliver in CRM** (tasks/campaigns).

**Mental model for nav:**

- **My profile** = private you + what goes public.  
- **Analytics** = your numbers (app only).  
- **Dashboard** = personal launchpad + my orgs.  
- **Org** = we hire/source/run programs.  
- **CRM** = we **execute** agreed work (tasks).

**Six terms in one line:**

| Term | Meaning |
|------|---------|
| **Profile** | Private workspace to manage your presence. |
| **Public profile** | What visitors see at `/{username}`. |
| **Analytics** | Your X metrics (private, stored snapshots). |
| **Dashboard** | Your personal home + org shortcuts. |
| **Org workspace** | Brand operations (jobs, sourcing, team). |
| **CRM** | Delivery board after you’re in a deal/campaign. |

---

## 8. Route / module inventory (linkary.xyz — high signal)

| Path pattern | Module |
|--------------|--------|
| `/onboarding` | Onboarding |
| `/app/dashboard` | Personal dashboard |
| `/app/profile`, `/app/profile/edit`, `/app/profile/insights`, `/app/profile/deals`, … | Profile cluster |
| `/app/analytics`, `/app/analytics/profile/...` | Analytics |
| `/app/org-invites` | Creator inbox |
| `/app/market` | Marketplace |
| `/app/explore` (or discovery) | Discovery |
| `/org/{slug}` | Org detail tabs |
| `/app/settings/*` | Settings |
| `/[username]` | Public profile |
| `/app/messages`, `/app/circles`, … | Social / work |

**CRM (`apps/crm`):** `/login`, `/tasks`, `/tasks/[id]`, `/campaigns`, `/campaigns/[id]`, `/submissions`, `/reports`, `/settings`, `/workspace/[slug]`.

---

## 9. What users see vs what powers it

| User sees | Powers it (truth) |
|-----------|-------------------|
| Public profile | `public_profile_view`, published sections |
| Follower count / snapshot on public | Public-safe aggregates; not full owner analytics |
| Own analytics charts | Worker + DB aggregates; refresh queues job |
| Org jobs list | `jobs` + `org_members` |
| Sourcing column | Org sourcing tables + RLS |
| CRM tasks | Sync API + `crm_tasks` + workspace linkage |
| “Unread” org invites | `org_job_invites` / program invites + inbox markers |

---

## 10. Confusion / risk list

1. **Two domains** (linkary + CRM) without clear in-product “why CRM”.  
2. **Active context** invisible until user notices switcher.  
3. **Analytics** vs **insights** vs **public** metrics — three layers.  
4. **Campaign** language in CRM vs **program** in Linkary.  
5. **Sync failure** → user accepted deal but no tasks (ops/debug surface).  
6. **Company** users: personal profile still exists alongside org — dual identity.

---

## 11. Simplification recommendation list (non-breaking)

1. **One sentence** in-app above CRM link: “After you accept work, open CRM for deliverables.”  
2. **Glossary** in help: Profile vs Public vs Analytics vs Org vs CRM.  
3. **Reduce duplicate “home” CTAs** — pick primary post-login destination by account type.  
4. **Rename or tooltips** for Quick snapshot vs Analytics (already improved in places).  
5. **Org onboarding** line: “Personal profile = you; Org = your brand.”  
6. **CRM onboarding** for first task: empty state explains sync from Linkary accept.

---

## How to explain Linkary to a new user in under 60 seconds

> “Linkary is where you **show your creator reputation** on a public page and where brands **post jobs and run programs**. You manage **your private profile** and **your X analytics** in the app—only you see the full charts. When you **join a project**, your **tasks and deliverables** move to our **CRM** (crm.linkary.xyz), which is your **execution workspace**. If you’re a **brand**, you switch to **org mode** to manage **jobs, sourcing, and team**—that’s separate from your personal profile.”

---

*Document generated from repository inspection (`apps/web`, `apps/crm`, `docs/*`, middleware, active-context, CRM sync). Update when major routes or sync behavior change.*
