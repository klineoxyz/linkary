# Linkary Recommended Implementation Plan

Post-audit plan: schema additions, org permissions, jobs vs gigs, route/IA cleanup, APIs, RLS, launch order, and deferrals.

---

## 1. Final recommended database schema additions

### 1.1 Launch-critical (P0/P1)

**Orgs**

- `orgs.cover_file_path text` (nullable) — for signed cover image. Optional: `cover_image_url` if you keep URL-based cover.
- If you add org socials: `orgs.telegram_url text`, `orgs.discord_url text`, `orgs.linkedin_url text` (or a single `org_socials jsonb`). Update `public_org_view` to include these.

**Org public team (choose one)**

- **Option A:** Add to `org_members`: `is_public boolean DEFAULT false`, `display_title text`. RLS: public SELECT only rows where `is_public = true` and org is published. Internal policies unchanged.
- **Option B:** New table `org_public_team` (id, org_id, name, role, avatar_url, sort_order int, created_at). RLS: anon can SELECT where org published; org owner/admin can CRUD.

**Gigs**

- `gigs.status`: extend check to `draft | open | closed | filled`. Migration: `ALTER TABLE gigs DROP CONSTRAINT IF EXISTS gigs_status_check; ALTER TABLE gigs ADD CONSTRAINT gigs_status_check CHECK (status IN ('draft','open','closed','filled'));` and backfill existing to `open` if needed.

**Applications (jobs)**

- No schema change required for "stages" if you keep accept/reject only. Optional: `applications.stage text` with check `('pending','shortlisted','interview','offer','hired','rejected','withdrawn')` and default `'pending'`.

**Reports (reviews)**

- New table: `reports` (id uuid PRIMARY KEY, reporter_id uuid REFERENCES auth.users NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL, reason text, created_at timestamptz DEFAULT now()). Index on (entity_type, entity_id). RLS: reporter can INSERT own; admins can SELECT (optional).

### 1.2 Optional / P2

- `audit_log` (id, table_name, row_id, action, by_user_id, payload jsonb, created_at). SECURITY DEFINER write; only service or superadmin read.
- `org_member_invites` (id, org_id, email or token, role, invited_by, expires_at, accepted_at). RLS: org owner/admin manage; invitee can SELECT own by token and UPDATE to accept.

---

## 2. Org membership and permissions model

### 2.1 Current

- **Roles:** owner, admin, member (org_members.role).
- **RLS:** Owner via orgs.owner_profile_id; admin via org_members.role IN ('owner','admin'). Member can only see own membership.

### 2.2 Recommended for launch (minimal)

- **Keep** owner / admin / member.
- **Document:** Owner = full control + transfer + delete org. Admin = full ops except transfer/delete. Member = view only (and any explicit "member can apply on behalf of org" if you add it).
- **Public team:** Use Option A (is_public, display_title on org_members) or Option B (org_public_team). If Option A, ensure RLS has a policy: anon can SELECT org_members where org.published and org_members.is_public = true; and that org_members INSERT/UPDATE/DELETE remain restricted to owner/admin.

### 2.3 Post-launch (P2)

- Add roles: editor (can update org + jobs + case studies, no member management), analyst (read analytics only), recruiter (manage jobs + applications only). Implement via:
  - Add role enum or new roles to org_members (e.g. role IN ('owner','admin','editor','recruiter','analyst','member')).
  - New RLS policies per resource: e.g. jobs UPDATE allowed for role IN ('owner','admin','editor','recruiter'); analytics SELECT for role IN ('owner','admin','editor','analyst','recruiter','member') if you expose org analytics.

---

## 3. Jobs vs gigs separation

### 3.1 Keep as-is

- **Jobs:** Org-owned; table `jobs` (org_id, type job|sprint, …). Applications → deals (profile ↔ org).
- **Gigs:** Profile-owned; table `gigs` (owner_profile_id, …). Gig applications → gig_deals (profile ↔ profile). Reviews via deal_id (org) or gig_deal_id (profile).

### 3.2 Clarifications

- **Naming:** "Sprint" in jobs is an org job type; don’t confuse with "gig" (profile opportunity). In UI, use "Job" and "Sprint" for org; "Gig" for profile-owned.
- **APIs:** Keep `POST /api/jobs/[jobId]/apply`, `POST /api/applications/[id]/accept` (creates deal). Add `GET /api/orgs/[orgId]/jobs` that returns jobs for that org only (or add query param to existing list jobs endpoint).

---

## 4. Route ownership and IA cleanup

### 4.1 Responsibilities (lock in)

| Path | Owner | Purpose |
|------|--------|---------|
| `/` | Landing | Marketing; sign in / sign up |
| `/overview` | App default | Logged-in home (overview) |
| `/dashboard` | Command center | Work, deals, brands, summary KPIs (real data only or clearly labeled placeholders) |
| `/analytics` | Analytics | Only deep analytics (X; later YT/TikTok) |
| `/profile` | Identity | Own profile; snapshot only; link to Analytics |
| `/[username]` | Public | Profile or org one-pager; no deep analytics |
| `/org/[orgId]` | Org | Org detail; tabs: dashboard, members, jobs, case studies, settings |
| `/work/requests` | Collab | Inbox/sent; create deal from accepted request |
| `/deal/[id]` | Deal | Deal detail; mark delivered/accepted; leave review |

### 4.2 Changes to make

- Add **`work`** to `RESERVED_PATHS` (see Gap Checklist).
- In **pathFromRoute** / **routeFromPathname**: ensure `/work` alone either 404s or redirects to `/work/requests` (after reserving `work`).
- **Dashboard:** Remove or replace mock data; or add a single "Demo data" banner and keep one or two charts as preview.

---

## 5. API endpoints needed

### 5.1 New or changed for launch

- **GET /api/orgs/[orgId]/jobs** — list jobs for org (optional; can be query on existing jobs list). Returns same shape as listJobs but filtered by org_id.
- **POST /api/reports** (P1) — body: entity_type, entity_id, reason. Auth required. Inserts into `reports` table.

### 5.2 Existing to rely on

- `POST /api/orgs/create` — create org (company account only).
- `GET/POST /api/analytics/ensure-backfill` — backfill analytics.
- `GET /api/analytics/x` — analytics charts/KPIs.
- `POST /api/jobs/[jobId]/apply` — apply to job.
- `POST /api/applications/[id]/accept` — accept application (creates deal).
- `PATCH /api/gig-applications/[id]/status` — accept/reject gig application.
- `POST /api/deals/[id]/mark-delivered`, `POST /api/deals/[id]/mark-accepted` — deal flow.
- Org members: use Supabase client with RLS (list members, add/remove/update role via org_members).

---

## 6. Supabase RLS considerations

### 6.1 Applications (jobs)

- **Current state:** Migration `20260239000000_applications_rls_and_job_admin.sql` already has **applications_select_private** (applicant profile, applicant org admin, or job org admin via is_job_org_admin). **No change required** for launch; verify in production.
- Keep **applications_insert_applicant**, **applications_update_org_admin**, **applications_update_applicant_withdraw**.

### 6.2 Org public team (if Option A)

- **org_members:** Add policy `org_members_select_public` FOR SELECT USING (
  org_id IN (SELECT id FROM orgs WHERE published = true)
  AND org_members.is_public = true
). Keep existing SELECT for members (user_id = auth.uid() or org owner/admin).

### 6.3 Reports (if added)

- **reports:** INSERT WITH CHECK (reporter_id = auth.uid()). SELECT: only reporter or superadmin (or no anon SELECT).

### 6.4 Gigs draft

- **gigs_public_select:** Keep `USING (is_public = true AND status = 'open')` so draft and closed/filled are not public. Owner policy already allows full CRUD on own gigs.

---

## 7. Launch order by priority

**Phase 1 — P0 (before launch)**

1. **Applications RLS** — Verify in production (applications_select_private already in place); no migration needed.
2. **RESERVED_PATHS** — Add `"work"`; deploy.
3. **Dashboard** — Replace or clearly label mock charts (banner or remove).
4. **Sitemap** — Add published orgs (slug) to sitemap; deploy.

**Phase 2 — P1 (launch week / soon after)**

5. **Org cover** — Column + upload + public_org_view.
6. **Org public team** — Option A or B; RLS; UI on org page.
7. **Org socials** — Columns or jsonb; public view + edit UI.
8. **GET /api/orgs/[orgId]/jobs** (or listJobs(orgId)) — Use in OrgDetailPage.
9. **Gig draft** — Status + UI.
10. **Review reporting** — reports table + POST /api/reports + "Report" on review.
11. **robots.txt** — Disallow /org, /deal, /work, /market, /messages, etc.
12. **Monitoring** — Queue depth / backfill health in readiness or ops.

**Phase 3 — P2 (later)**

13. Org roles (editor, analyst, recruiter); org_member_invites; audit_log; application stages; moderation; YouTube/TikTok analytics.

---

## 8. What can be deferred until after launch

- **Editor / analyst / recruiter roles** — Launch with owner + admin + member only.
- **Org member invites (email/link)** — Launch with "add by username" only.
- **Application pipeline stages** (shortlist, interview, offer) — Launch with pending → accept/reject/withdrawn.
- **Job types** (full_time, contract, etc.) — Launch with job/sprint only if that’s enough.
- **Review moderation** (hide/delete) — Launch with reporting only; add moderation in P2.
- **Full audit log** — Defer; add when compliance or trust requires.
- **YouTube / TikTok analytics** — Already disabled in UI; keep disabled.
- **Dashboard fully real** — Launch with real deals/orgs + labeled placeholders or reduced charts; iterate post-launch.
- **Structured data (JSON-LD)** for SEO — Optional; defer unless SEO strategy requires.
- **Org categories/tags** beyond org_type — Defer unless discovery product needs it.

---

## 9. File paths reference

| Change | File(s) |
|--------|---------|
| RESERVED_PATHS | `apps/web/src/lib/reservedPaths.ts` |
| Dashboard mock data | `apps/web/src/figma/app/components/DashboardPage.tsx` |
| Sitemap (add orgs) | `apps/web/src/app/sitemap.ts` |
| robots disallow | `apps/web/src/app/robots.ts` |
| Route sync (work) | `apps/web/src/figma/app/App.tsx` (pathFromRoute, routeFromPathname) |
| Applications RLS | New migration or `supabase/migrations/` (applications policies) |
| Org jobs API | New `apps/web/src/app/api/orgs/[orgId]/jobs/route.ts` or extend jobs list |
| Org cover/socials/view | Migration + `public_org_view`; org edit in `OrgDetailPage.tsx` or org settings |
| Reports | New migration `reports` table; `apps/web/src/app/api/reports/route.ts` |
| Gigs draft | Migration (gigs status check); ProfileEditPage gig create/edit |

---

*End of implementation plan.*
