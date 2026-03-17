# CRM launch execution checklist

Single ordered list for launch day. No code changes. Execute in sequence.

---

## Phase 1 — Database

### Step 1.1 Apply Supabase migrations

**Order (run in this sequence):**

1. `20260405000000_crm_schema_tables.sql`
2. `20260405000001_crm_rls.sql`
3. `20260405100000_crm_submissions_campaign_nullable.sql`
4. `20260406100000_crm_sync_idempotency_and_failures.sql`
5. `20260406100001_crm_linked_org_id_index_and_unique.sql`

**How:** Supabase Dashboard → SQL Editor, or CLI: `supabase db push` (if your workflow applies all pending migrations). If applying manually, run each file in order. Confirm no errors.

- [ ] All five migrations applied successfully.

---

### Step 1.2 Run CRM_PRE_LAUNCH_VERIFICATION SQL

**In Supabase SQL Editor, run in order:**

**2.1 Duplicate campaigns (expect 0 rows):**
```sql
SELECT workspace_id, source_linkary_campaign_id, count(*)
FROM public.crm_campaigns
WHERE source_linkary_campaign_id IS NOT NULL
GROUP BY workspace_id, source_linkary_campaign_id
HAVING count(*) > 1;
```

**2.2 Duplicate tasks (expect 0 rows):**
```sql
SELECT task_bundle_id, linkary_task_id, count(*)
FROM public.crm_tasks
WHERE task_bundle_id IS NOT NULL AND linkary_task_id IS NOT NULL AND linkary_task_id != ''
GROUP BY task_bundle_id, linkary_task_id
HAVING count(*) > 1;
```

**2.3 Missing linked_org_id (list for backfill):**
```sql
SELECT id, type, slug, name, created_at
FROM public.crm_workspaces
WHERE type IN ('org', 'project', 'brand', 'agency')
  AND linked_org_id IS NULL
ORDER BY created_at DESC;
```

- [ ] 2.1 returned 0 rows.
- [ ] 2.2 returned 0 rows.
- [ ] 2.3 reviewed; noted which workspaces need backfill.

---

### Step 1.3 Backfill linked_org_id

For each org-style workspace that will receive job-acceptance sync (Linkary org that posts jobs):

1. Get the Linkary **org id** (`orgs.id` from Linkary, e.g. org profile URL or `orgs` table).
2. Run (replace UUIDs):
```sql
UPDATE public.crm_workspaces
SET linked_org_id = '<linkary_orgs.id>', updated_at = now()
WHERE id = '<crm_workspace_id>';
```

- [ ] All org workspaces that need sync have `linked_org_id` set.

---

## Phase 2 — Vercel and domain

### Step 2.1 Create second Vercel project (CRM)

1. [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**.
2. Import the **same repo** as linkary.xyz.
3. **Root Directory:** `apps/crm`.
4. **Framework:** Next.js (default). Build / output / install: default.
5. **Do not add domain yet.** Deploy once to verify build.
6. If build fails (monorepo): **Settings → General** → **Root Directory** empty, **Build Command:** `pnpm install && pnpm --filter crm build`, **Output Directory:** `apps/crm/.next`.

- [ ] CRM project created.
- [ ] Build succeeds.

---

### Step 2.2 Attach crm.linkary.xyz

1. CRM project → **Settings** → **Domains** → Add: `crm.linkary.xyz`.
2. Copy the **target** Vercel shows (e.g. `crm-linkary-xxx.vercel.app` or CNAME target).
3. In your DNS (e.g. Namecheap): add **CNAME** — **Host:** `crm`, **Value:** that target, **TTL:** Auto. Save.
4. Wait for DNS (up to a few minutes). In Vercel Domains, confirm **Verified**.

- [ ] Domain added in Vercel.
- [ ] CNAME set in DNS.
- [ ] Domain shows Verified in Vercel.

---

### Step 2.3 Set env vars — apps/web (linkary.xyz project)

In the **existing** linkary.xyz Vercel project → **Settings** → **Environment Variables**, add or confirm:

| Name | Value | Environment |
|------|--------|-------------|
| `CRM_APP_URL` | `https://crm.linkary.xyz` | Production |
| `CRM_SYNC_SECRET` | (same secret as CRM; generate a strong random string) | Production |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `.linkary.xyz` | Production |

(Other vars like `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` should already exist.)

- [ ] `CRM_APP_URL` set.
- [ ] `CRM_SYNC_SECRET` set (same value you will set in CRM).
- [ ] `NEXT_PUBLIC_COOKIE_DOMAIN` set for Production.

---

### Step 2.4 Set env vars — apps/crm (CRM project)

In the **CRM** Vercel project → **Settings** → **Environment Variables**, set:

| Name | Value | Environment |
|------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` (same as web) | Production (and Preview if needed) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon key, same as web) | Production (and Preview if needed) |
| `NEXT_PUBLIC_APP_URL` | `https://crm.linkary.xyz` | Production |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `.linkary.xyz` | Production |
| `CRM_SYNC_SECRET` | (same value as in apps/web) | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase service role key) | Production |

- [ ] All six vars set for Production.
- [ ] Redeploy CRM after adding vars so they take effect.

---

## Phase 3 — Supabase and auth

### Step 3.1 Supabase redirect URLs

Supabase Dashboard → your project → **Authentication** → **URL Configuration** → **Redirect URLs**. Add:

- `https://crm.linkary.xyz/auth/callback`

Keep existing linkary.xyz URLs. Save.

- [ ] CRM redirect URL added and saved.

---

### Step 3.2 Test shared auth

1. In a **desktop** browser, go to **https://linkary.xyz** and sign in (magic link or your normal flow).
2. In the **same** browser, open **https://crm.linkary.xyz**.
3. You should land in CRM **without** being asked to sign in again (same session).
4. Sign out from one; confirm session is cleared as expected (or that both respect sign-out per your setup).

- [ ] Logged in on linkary.xyz; opening crm.linkary.xyz does not ask for login again.
- [ ] Session / sign-out behavior correct.

---

## Phase 3.5 — Pre-E2E: /tasks workspace load

Before running full E2E, confirm that a **fresh individual user** can open Tasks and that the creator workspace and personal board load without error.

1. Use (or create) a user that has a **`public.profiles`** row with **`profile_type = 'individual'`**.
2. Sign in to **crm.linkary.xyz** (or open it after signing in on linkary.xyz so the session is shared).
3. Open **/tasks**.
4. **Check:** The Tasks page loads with the personal board; there is **no** “Could not load workspace” (or similar) error.

If you see a workspace-load error, see [CRM_TASKS_WORKSPACE_BOOTSTRAP.md](./CRM_TASKS_WORKSPACE_BOOTSTRAP.md) for root causes and the verification checklist.

- [ ] Fresh individual user can open /tasks; creator workspace and personal board load successfully; no “Could not load workspace” error.

---

## Phase 4 — Full E2E flow

### Step 4.1 Acceptance → sync → proof → review

1. **Org owner:** On linkary.xyz, accept a job application for a job whose **org** has a CRM workspace with `linked_org_id` set. Use an org you backfilled in Step 1.3.
2. **Check:** Acceptance returns 200; deal created.
3. **CRM:** Open crm.linkary.xyz. As the **accepted creator**, go to **Tasks** — synced task(s) appear (creator workspace bootstrapped if needed). As **org user**, go to **Campaigns** — new campaign and participant appear.
4. **Creator:** Open a synced task → submit a **proof URL** → save. Status shows pending (or equivalent).
5. **Org user:** Open that **campaign** in CRM → find the submission → **Approve** or **Reject** or **Needs revision**. Confirm only authorized org members can review.
6. **Idempotency:** Trigger the same sync again (e.g. same payload via API or re-accept flow if your setup allows). Confirm no duplicate campaigns/participants/tasks.

- [ ] Acceptance succeeds and sync creates campaign + tasks.
- [ ] Creator sees tasks; can submit proof.
- [ ] Org can review submission; unauthorized cannot.
- [ ] Repeated sync does not create duplicates.

---

## Exact env vars reference

**apps/web (linkary.xyz) — add/confirm for Production:**

| Variable | Example / note |
|----------|-----------------|
| `CRM_APP_URL` | `https://crm.linkary.xyz` |
| `CRM_SYNC_SECRET` | Strong random string; **must match CRM** |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `.linkary.xyz` |

**apps/crm — set for Production:**

| Variable | Example / note |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key from Supabase |
| `NEXT_PUBLIC_APP_URL` | `https://crm.linkary.xyz` |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `.linkary.xyz` |
| `CRM_SYNC_SECRET` | **Same** as in apps/web |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase |

---

## Manual QA checklist

### Desktop

- [ ] Login at crm.linkary.xyz (magic link); redirect after login works.
- [ ] After login on linkary.xyz, open crm.linkary.xyz — no second login.
- [ ] Home: switcher or no-workspace state correct for role (creator / org / both / none).
- [ ] Tasks: list loads; create task; open task; change status; submit proof (if applicable).
- [ ] Campaigns: list loads; open campaign; see submissions; approve/reject/needs revision.
- [ ] Sidebar: Home, Tasks, Campaigns only; sign out works.
- [ ] Direct visits to /submissions, /reports, /settings show “Coming soon” style content.

### Phone (one device)

- [ ] crm.linkary.xyz loads; login or shared session works.
- [ ] Sidebar/nav usable (stacked or hamburger if applicable).
- [ ] Tasks list and task detail readable; table scrolls horizontally if needed.
- [ ] Campaign list and campaign detail readable; tables scroll horizontally.
- [ ] Review controls (Approve/Reject/Needs revision) usable; note input works.

### Tablet (one device)

- [ ] Same as phone; layout adapts (e.g. sidebar row); tables and forms usable.
- [ ] No horizontal overflow or broken layout on key pages.

---

## Rollback / recovery

### CRM deploy fails

- Fix build (Root Directory, build command, monorepo install) in Vercel and redeploy.
- If needed, remove the CRM project and re-add with correct root `apps/crm` and env vars; no DB rollback needed for “deploy” only.

### Domain (crm.linkary.xyz) fails or not verified

- Check CNAME: Host `crm`, value = exact Vercel target; wait for DNS propagation.
- In Vercel, remove and re-add the domain to get a fresh target if required.
- Temporarily use the default `*.vercel.app` URL for CRM to test; add cookie domain and redirect URL for that host if you need to test auth.

### Sync fails (no campaign/tasks after acceptance)

- In apps/web, check logs for `[CRM sync]` and optional `sync_failure_id`.
- In Supabase, run **2.4** from CRM_PRE_LAUNCH_VERIFICATION.md to list recent `crm_sync_failures`; use `payload` to retry `POST /api/sync/linkary` with same body.
- Confirm **org** for the job has a CRM workspace with `linked_org_id` set (Step 1.3). If missing, backfill and retry sync (same payload).

### linked_org_id mapping missing

- Run **2.3** (missing linked_org_id) and backfill each org workspace that should receive sync (Step 1.3).
- After backfill, retry sync for that org (re-send same payload to `/api/sync/linkary` or re-accept if you have a way to trigger again). Sync is idempotent.

### Need to disable CRM or sync without code change

- In apps/web, remove or comment out `CRM_APP_URL` / `CRM_SYNC_SECRET` so sync is not called (acceptance will still succeed; sync will no-op or not be invoked depending on implementation).
- Optionally in CRM project, remove `CRM_SYNC_SECRET` so sync API returns 401. No migration rollback needed to “turn off” sync.
