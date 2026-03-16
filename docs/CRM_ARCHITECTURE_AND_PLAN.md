# CRM workspace — architecture and implementation plan

**Product:** CRM for Linkary at `crm.linkary.xyz`  
**Constraint:** Do not refactor or destabilize `linkary.xyz`. Prefer isolation.

---

## 1. Repo audit summary

| Item | Current state |
|------|----------------|
| **Workspace** | `pnpm-workspace.yaml`: `packages: ["apps/*"]` — no `packages/` folder |
| **Apps** | `apps/web` (Next.js, linkary.xyz), `apps/worker`, `apps/api` |
| **Shared packages** | None. No `packages/shared` or `packages/ui`. |
| **Supabase** | Single project. Migrations in `supabase/migrations/` (timestamped). `createServerSupabase()` (cookies), `createServiceSupabase()` (service role) in web. |
| **Auth** | Supabase Auth. `profiles.id = auth.uid()`. Session via cookies; API routes use Bearer or cookie. |
| **Linkary convert flow** | `POST /api/collab-requests/[id]/convert` creates gig + gig_deal; no CRM hook today. |
| **Gigs/Jobs** | `gigs`, `gig_deals`, `jobs` (org jobs); sprint type exists. |

**Conclusion:** No shared npm packages. Reuse = same Supabase project + same auth identity; code reuse = copy minimal patterns into CRM or add `packages/shared` later. **Do not import from `apps/web` into `apps/crm`** to keep deployment and ownership isolated.

---

## 2. Architecture decision: separate app (`apps/crm`)

**Recommendation: create `apps/crm` (new Next.js app), deployed to `crm.linkary.xyz`.**

| Approach | Pros | Cons |
|----------|------|------|
| **A. New app `apps/crm`** | Isolated deploy, no risk to linkary.xyz; separate bundle, env, and release cycle; clear ownership | Two apps to deploy; duplicate auth/supabase setup (minimal) |
| **B. Subdomain routing in web** | Single codebase | High risk: new routes, middleware, and role logic inside production app; harder to gate/rollback |

**Choice: A.** Isolation over cleverness. No changes to `apps/web` for CRM routes; no subdomain logic in the main app.

**Subdomain:** Handled at infra/DNS: point `crm.linkary.xyz` to the CRM deployment (e.g. Vercel project or separate host). No code change in either app.

---

## 3. App and schema boundaries

- **apps/web (linkary.xyz):** Unchanged. No new CRM routes, no CRM imports, no CRM feature flags in web.
- **apps/crm (crm.linkary.xyz):** New app. Own routes, own UI, own API routes. Uses same Supabase project (same env vars) but **only** CRM tables and RLS.
- **Supabase:** Same project. New schema or new tables with `crm_` prefix in `public` (or a dedicated `crm` schema). RLS so CRM tables are invisible to web app logic and web RLS does not apply to CRM tables.
- **Sync from Linkary → CRM:** Either (1) CRM exposes an idempotent API (e.g. `POST /api/sync/accept-sprint`) called by web after convert, or (2) worker/edge function triggered by DB or webhook. Web change is minimal: one call to sync API or queue. Prefer (1) with env-gated call from web so web stays simple.

---

## 4. What gets reused vs untouched

**Reused (same infra, no copy into web):**

- Supabase project (URL, anon key, service role for CRM backend)
- Auth identity: same `auth.uid()`; CRM resolves `profiles` by `profiles.id = auth.uid()` for display only; no dependency on web’s profile shape beyond id/username/display_name
- Design: reuse **concepts** (cards, spacing, typography); CRM can copy Tailwind + a small set of component patterns into `apps/crm` or use a shared design token file later

**Not reused (no imports from web):**

- No import from `apps/web` into `apps/crm`. CRM has its own:
  - Supabase client helpers (server + optional service role)
  - Auth middleware / get-session
  - Types (CRM types in `apps/crm` or a future `packages/crm-types`)

**Untouched in production web app:**

- `apps/web/**` — no new routes, no CRM-specific code, no subdomain logic
- `apps/web/src/app/**` — unchanged
- `apps/web/src/figma/**` — unchanged
- Existing Supabase migrations — unchanged; new migrations only add CRM tables/policies

---

## 5. Route map for CRM

| Route | Purpose | Who |
|-------|---------|-----|
| `/` | Workspace home or redirect to default workspace | All |
| `/login` | Auth (Supabase redirect or magic link) | Unauthenticated |
| `/tasks` | Task board (kanban) | Creator / Org |
| `/campaigns` | Campaign list | Org / Agency |
| `/campaigns/[id]` | Campaign detail (ops, submissions, report) | Org / Agency |
| `/submissions` | Submissions queue (or under campaign) | Org |
| `/reports` | Report list / export hub | Org |
| `/settings` | Workspace settings | Workspace admin |
| `/workspace/[slug]` | Switch context / workspace home | All |

Optional: `/workspace/[slug]/tasks`, `/workspace/[slug]/campaigns` if you want workspace in path. For MVP, workspace can be a selector in layout and routes stay flat.

---

## 6. Implementation milestones

| Milestone | Scope | Risk to linkary.xyz |
|-----------|--------|----------------------|
| **M1** | Scaffold CRM app + auth/workspace shell | None (new app only) |
| **M2** | DB schema (crm_* tables) + RLS | None (new tables only) |
| **M3** | Creator task board MVP | None |
| **M4** | Org campaign dashboard MVP | None |
| **M5** | Submission workflow (submit proof, approve/reject) | None |
| **M6** | Linkary sync: sprint/gig acceptance → CRM task bundle | Minimal: optional call from web convert route or worker |
| **M7** | Reports, exports, aggregates (daily metrics, CSV) | None |
| **M8** | Tests (CRM-only + idempotent sync); polish | None |

---

## 7. Data model (summary)

- **crm_workspaces** — type (creator | org | project | brand | agency), slug, name, owner, linked_org_id
- **crm_workspace_members** — workspace_id, profile_id, role
- **crm_boards** — workspace_id, name, kind (personal | campaign | ops)
- **crm_board_columns** — board_id, key, label, sort_order
- **crm_tasks** — workspace_id, board_id, campaign_id?, task_bundle_id?, source_type, title, status, platform, due_at, recurrence_rule, metadata
- **crm_task_bundles** — campaign_id, participant_profile_id, expected/completed counts, contribution_percent
- **crm_campaigns** — workspace_id, source_linkary_campaign_id?, title, dates, budget, status
- **crm_campaign_participants** — campaign_id, participant_profile_id, role, status
- **crm_submission_requirements** — campaign_id, platform, requirement_type, validation_rules
- **crm_submissions** — task_id, campaign_id, participant_profile_id, url, status, reviewer_id, metrics_snapshot
- **crm_activity_log** — workspace_id, entity_type, entity_id, actor_id, action, payload
- **crm_campaign_metrics_daily** — campaign_id, day, totals (views, engagements, posts, spend, mindshare_score)
- **crm_campaign_reports** — campaign_id, report_version, totals, top_contributors, chart_series, generated_at

Metrics: stored in aggregates; no live heavy computation on page load. Mindshare = versioned, formula-based proxy; label clearly when data is missing or proxy.

---

## 8. Sync contract (Linkary → CRM)

- **Event:** Creator accepts sprint/gig on Linkary (e.g. collab convert or gig_application accepted).
- **Action:** Create or update CRM campaign participation + task bundle + tasks for that creator.
- **Implementation options:**
  1. **Web calls CRM API:** After successful convert in `apps/web`, `POST https://crm.linkary.xyz/api/sync/accept-sprint` (or internal URL) with payload `{ linkary_gig_deal_id, campaign_id?, participant_profile_id, deliverables[] }`. Idempotent by `linkary_gig_deal_id` or (campaign_id + participant_profile_id). Requires CRM to be deployed and env in web to enable.
  2. **Worker:** Worker listens to DB or queue, calls same logic. No change to web.
  3. **Supabase Edge Function / webhook:** On insert to `gig_deals` or `collab_requests` update, invoke CRM sync. No change to web app code.

For M6, prefer (1) with feature flag or env so web change is one optional fetch; if CRM unavailable, web flow unchanged.

---

## 9. Files created (no edits to existing web files)

- `docs/CRM_ARCHITECTURE_AND_PLAN.md` (this file)
- `apps/crm/` — full new app:
  - `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `src/app/globals.css`
  - `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
  - `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/login/LoginForm.tsx`, `src/app/auth/callback/route.ts`
  - `src/app/(dashboard)/layout.tsx`, `src/components/DashboardShell.tsx`
  - `src/app/(dashboard)/tasks/page.tsx`, `campaigns/page.tsx`, `campaigns/[id]/page.tsx`, `submissions/page.tsx`, `reports/page.tsx`, `settings/page.tsx`, `workspace/[slug]/page.tsx`
  - `.env.example`
- `supabase/migrations/20260405000000_crm_schema_tables.sql` — crm_workspaces, crm_workspace_members, crm_boards, crm_board_columns, crm_campaigns, crm_task_bundles, crm_tasks, crm_campaign_participants, crm_submission_requirements, crm_submissions, crm_activity_log, crm_campaign_metrics_daily, crm_campaign_reports
- `supabase/migrations/20260405000001_crm_rls.sql` — RLS for all crm_* tables (workspace member / participant visibility)

---

## 10. Go-live checklist (CRM only)

- [ ] CRM app builds and runs locally
- [ ] Auth works (same Supabase project)
- [ ] RLS ensures creator sees only own/participant data; org sees only own workspaces
- [ ] No regression: linkary.xyz build and tests unchanged
- [ ] crm.linkary.xyz DNS and deploy target configured
- [ ] Env vars for CRM app (same Supabase; optional CRM-specific keys for sync)
