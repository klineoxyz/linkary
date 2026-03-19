# Launch final product-completion pass

## 1. Audit summary

### What was actually broken

- **`/org/[slug]` and `/org/[slug]?tab=insights`** — Org page showed “Org not found” for valid orgs (e.g. desicryptoclub). Cause: resolution was client-only; slug lookup and usernames fallback could fail (e.g. unpublished orgs not in `public_org_view`, or segment/encoding). No server-side validation or 404.
- **CRM “No org workspace access”** — Org admins had no linked CRM workspace for their Linkary org. There was no bootstrap: `crm_workspaces.linked_org_id` was only set when a workspace was created elsewhere, so org members saw empty campaigns with no way to get a workspace.

### What was actually working

- **`/tasks`** — Creator workspace bootstrap (after prior RLS fix); individuals see their task board.
- **`/app/analytics/org/[slug]`** — Redirect to `/org/{slug}?tab=insights` existed; target org page was the one failing.
- **CRM tasks/campaigns routes** — Auth, layout, and list/detail pages worked when the user had the right workspaces.
- **Linkary job/gig** — `jobs` already had `objective`, `links` (guidance URLs); create form used them for sprints.

### What was confusing

- “No org workspace access” sounded like a permission error; in practice it meant “no CRM workspace linked to your org yet.”
- Org page failing for valid slugs made it seem like org data or routing was wrong; the fix was server-side resolution and passing resolved org id to the client.

### What was changed

1. **Org route**
   - **Server resolution** — `resolveOrgBySegment()` in `resolveOrgServer.ts`: resolve by UUID, then by slug on `orgs` (any published state), then by usernames → org id. Used from org page Server Component.
   - **Org page** — Converted to async Server Component: resolve org, `notFound()` if missing, else render `OrgPageClient` with `initialOrgId`.
   - **Client** — `OrgRouteProvider` passes `initialOrgId`; `OrgDetailPage` uses it to load org by id first, so the page works even when slug/usernames path would fail.
2. **CRM org workspace**
   - **Bootstrap** — `ensureOrgWorkspacesForUser()`: for each Linkary org where the user is owner/admin, ensure a CRM workspace with `linked_org_id` and add user as member (+ campaign board). Called on `/campaigns` when user has no org workspaces.
   - **Copy** — “No org workspace in CRM” and short explanation that org admin can link from Linkary.
3. **Jobs schema**
   - **Migration** — `20260422000000_jobs_campaign_definition_fields.sql`: added `promoted_org_id`, `required_platforms`, `promoted_social_handles`, `weekly_required_posts`, `daily_engagement_required` to `jobs`. Form wiring and sync mapping to CRM campaigns are left for a follow-up.

---

## 2. Exact files touched

| File | Change |
|------|--------|
| `apps/web/src/lib/resolveOrgServer.ts` | **New.** Server-only org resolution by segment (uuid / slug / usernames). |
| `apps/web/src/lib/orgRouteContext.tsx` | **New.** Client context for `initialOrgId` from server. |
| `apps/web/src/app/org/[orgId]/page.tsx` | **Replaced.** Async Server Component: resolve org, `notFound()` or render client with `initialOrgId`. |
| `apps/web/src/app/org/[orgId]/OrgPageClient.tsx` | **New.** Client wrapper: `OrgRouteProvider` + `AppWithProviders`. |
| `apps/web/src/figma/app/components/OrgDetailPage.tsx` | Use `useOrgRouteInitialId()`; when set, load org by id first. |
| `apps/crm/src/lib/orgWorkspaceBootstrap.ts` | **New.** `ensureOrgWorkspacesForUser()`: create linked org workspace + member + board for org admins. |
| `apps/crm/src/app/(dashboard)/campaigns/page.tsx` | Call bootstrap when no org workspaces; clearer empty-state copy. |
| `supabase/migrations/20260422000000_jobs_campaign_definition_fields.sql` | **New.** Job columns for campaign definition (promoted org, platforms, handles, cadence). |
| `docs/LAUNCH_FINAL_PRODUCT_COMPLETION_PASS.md` | This file. |

---

## 3. Migrations required

- **`20260422000000_jobs_campaign_definition_fields.sql`** — Add campaign-definition columns to `jobs`. Run with `supabase db push` or SQL editor.
- **Phase 1 migration** (if not already applied): `20260421000000_crm_workspaces_owner_select_rls_fix.sql` (CRM creator bootstrap).

---

## 4. Env / config

No new env for this pass. Existing:

- **Web + CRM** — `NEXT_PUBLIC_COOKIE_DOMAIN=.linkary.xyz` for shared session when needed.
- **Linkary → CRM sync** — `CRM_APP_URL`, `CRM_SYNC_SECRET` (and CRM `SUPABASE_*`) for task/campaign sync.

---

## 5. Route-by-route verification

| Route | Status |
|-------|--------|
| **`/{username}`** | Unchanged. `(public)/[username]/page.tsx` + entity resolver. |
| **`/org/[slug]`** | **Fixed.** Server resolves by slug/uuid/usernames; `notFound()` if invalid; client gets `initialOrgId` and loads org. |
| **`/org/[slug]?tab=insights`** | Same as above; tab applied by client. |
| **`/app/analytics/org/[slug]`** | Redirects to `/org/{slug}?tab=insights`; with org fix, target page and insights tab load. |
| **`/tasks`** | Unchanged; creator bootstrap (and RLS fix) in place. |
| **`/tasks/[id]`** | Unchanged; auth via layout; `notFound()` when task missing. |
| **`/campaigns`** | **Fixed.** Org workspace bootstrap for org admins; clearer copy when no org workspace. |
| **`/campaigns/[id]`** | Unchanged; auth via layout; `notFound()` when campaign missing. |

---

## 6. Campaign-definition verification

### Fields on Linkary job/gig (after migration)

- **Existing:** `objective`, `links` (array of `{ label, url }`), `description`, `apply_url`.
- **New (schema only):** `promoted_org_id`, `required_platforms` (text[]), `promoted_social_handles` (jsonb), `weekly_required_posts` (int), `daily_engagement_required` (text).

### Mapping to CRM

- CRM campaigns already have: `promoted_org_id`, `promoted_social_handles`, `required_platforms`, `weekly_required_posts`, `daily_engagement_required`.
- Sync today sends: `source_linkary_campaign_id`, `campaign_title`, `tasks`. It does **not** yet pass the new job fields into campaign creation. **Intentionally deferred:** extend sync and CRM campaign create/update to read these from the job in a follow-up.

### What creators see

- In CRM they see task/campaign context and existing guidance (from current sync/UI). Full campaign-definition fields (promoted org, platforms, handles, cadence) will appear once sync and CRM campaign form are wired to the new job columns.

### What org reviewers see

- Campaign list and detail as today. Campaign definition (promoted entity, platforms, handles, objective) in CRM can be extended to use the new job fields once sync is updated.

### Intentionally deferred

- Linkary create-job form: no new inputs for promoted_org_id, required_platforms, promoted_social_handles, weekly_required_posts, daily_engagement_required (schema is ready).
- Sync payload and CRM campaign creation: not yet mapping the new job columns to CRM campaign fields.

---

## 7. Access-model verification

- **Individuals** — Use `/tasks`. Creator workspace bootstrap (and RLS fix) gives them a personal board. “No org workspace” does not apply.
- **Org members** — Use `/campaigns` when their org has a linked CRM workspace. **Bootstrap:** on first visit to `/campaigns`, org owners/admins get a CRM workspace created and linked to their Linkary org, so they see Campaigns (possibly empty) instead of “No org workspace in CRM.”
- **“No org workspace in CRM”** — Shown when the user has **no** CRM org workspace. Correct when: (1) user is not an org owner/admin, or (2) bootstrap ran but failed (e.g. RLS). Copy explains that the org can be linked from Linkary.

---

## 8. Regression check

- **Onboarding** — Not touched.
- **Referrals** — Not touched.
- **Analytics** — Stored-data-only and owner/cross-user flows unchanged.
- **Sourcing** — Not touched.
- **CRM sync** — Contract and trigger unchanged; new job columns not yet sent in sync (deferred).
- **Org authority** — Still from `org_members`; `is_org_admin` and existing RLS unchanged.
- **Active context** — Not changed.

---

## 9. Final verdict

- **Org routes** — Valid orgs resolve; invalid segments 404. Org insights path works end-to-end with the redirect.
- **CRM** — Tasks work for individuals; campaigns work for org admins after bootstrap; empty state and copy are accurate.
- **Campaign definition** — Schema on `jobs` supports promoted entity, platforms, handles, and cadence; form and sync mapping are deferred.
- **Linkary ↔ CRM** — Boundaries are clear: Linkary for profile, org, jobs, deals; CRM for tasks and campaign review; org workspace bootstrap connects org admins to Campaigns.

**Remaining (in launch order)**

1. **Wire job campaign fields** — Add inputs for promoted_org_id, required_platforms, promoted_social_handles, weekly_required_posts (and optional daily_engagement_required) on job/sprint create and map them in Linkary → CRM sync and CRM campaign create/update.
2. **Optional** — When sync creates/updates a campaign, pass through job’s `objective`, `links`, and new campaign-definition fields so creators and reviewers see them in CRM.

Product is in a state where invited beta can use individual flow, org flow, org route and insights, and CRM tasks and campaigns (with org workspace bootstrap). Remaining work is finishing campaign-definition UX and sync, not core route or access fixes.
