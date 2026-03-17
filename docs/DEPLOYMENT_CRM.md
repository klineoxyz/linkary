# CRM deployment (crm.linkary.xyz)

Deploy the CRM app as a **second Vercel project** from the same monorepo. No changes to the existing linkary.xyz app.

---

## Production structure

| App        | Vercel project     | Domain            |
|-----------|--------------------|-------------------|
| apps/web  | (existing)         | linkary.xyz       |
| apps/crm  | **new project**    | crm.linkary.xyz   |

---

## 1. Second Vercel project setup

1. In [Vercel Dashboard](https://vercel.com/dashboard), click **Add New** → **Project**.
2. **Import** the same GitHub repository you use for linkary.xyz.
3. Configure:
   - **Root Directory:** **`apps/crm`** (required).
   - **Framework Preset:** Next.js (auto-detected).
   - **Build Command:** leave default (`next build`).
   - **Output Directory:** leave default (`.next`).
   - **Install Command:** leave default.

4. Deploy. If the build fails (e.g. monorepo install), use **Settings → General** overrides as a fallback:
   - **Root Directory:** leave empty.
   - **Build Command:** `pnpm install && pnpm --filter crm build`
   - **Output Directory:** `apps/crm/.next` (if your pipeline expects it).

---

## 2. Required env vars (CRM project)

In the CRM Vercel project → **Settings → Environment Variables**:

| Name                           | Value                    | Notes                    |
|--------------------------------|--------------------------|--------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`     | `https://xxx.supabase.co`| Same as linkary.xyz      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| (anon key)               | Same as linkary.xyz      |
| `NEXT_PUBLIC_APP_URL`          | `https://crm.linkary.xyz`| Canonical CRM URL for auth redirects and links. |
| `NEXT_PUBLIC_COOKIE_DOMAIN`    | `.linkary.xyz`           | **Production only.** Share auth with linkary.xyz. Set in **both** Vercel projects (web + CRM) for production. Leave **unset** for local and preview unless you intentionally need shared auth on preview. |
| `CRM_SYNC_SECRET`             | (shared secret)          | **Optional.** Required for Linkary→CRM sync API. Set in CRM project; use same value in apps/web when calling the sync endpoint. |
| `SUPABASE_SERVICE_ROLE_KEY`   | (service role key)       | **Optional.** Required in apps/crm for the sync API route only (server-side; never exposed to client). |

Apply to **Production** for cookie domain; other vars as needed for Production, Preview, and Development.

---

## 3. Supabase auth redirect URLs

In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication → URL Configuration** → **Redirect URLs**, add:

- **Production:** `https://crm.linkary.xyz/auth/callback`
- **Local:** `http://localhost:3002/auth/callback`

Keep existing linkary.xyz redirect URLs. Save.

---

## 4. Namecheap DNS (crm subdomain)

- Add **one** CNAME record: **Host** = `crm`, **Value** = exact target from Vercel (CRM project → Settings → Domains → add `crm.linkary.xyz` → copy target), **TTL** = Automatic.
- Leave existing **@** and **www** records unchanged.

---

## 5. Post-deploy verification checklist

- [ ] **CRM build passes** — Vercel build completes successfully.
- [ ] **Domain verified** — `crm.linkary.xyz` shows Verified in Vercel Domains.
- [ ] **crm.linkary.xyz loads** — Login or redirect to /tasks.
- [ ] **Auth callback works** — Magic link sign-in redirects to CRM and session persists.
- [ ] **No regression on apps/web** — linkary.xyz behavior unchanged.

---

## 6. Role-aware access verification checklist

After shared auth (cookie domain) is in place, verify role-aware routing on crm.linkary.xyz:

- [ ] **No second login** — Log in on linkary.xyz, then open crm.linkary.xyz in the same browser; you should land in CRM without being asked to sign in again.
- [ ] **Individual user** — User with only a creator workspace lands on `/tasks` (task board) when opening `/`.
- [ ] **Org / project user** — User with only org-style workspace(s) lands on `/campaigns` (org dashboard) when opening `/`.
- [ ] **Dual-access user** — User with both creator and org workspaces sees the workspace switcher at `/` with options: “My tasks” and “Campaigns”.
- [ ] **No workspace yet** — User with no CRM workspaces sees the “No CRM workspace yet” page at `/`. Only **individual** creator accounts can use “Set up my task board” to bootstrap a creator workspace; org/project/company profiles do not get a personal board and see a no-access state on `/tasks` instead of bootstrapping.

---

## 7. Creator bootstrap and no-access verification checklist

- [ ] **Org-only user cannot bootstrap creator** — User with only org workspace(s) and no creator workspace must not get a creator workspace when opening `/tasks`; they see the no-access state (“You don’t have access to a personal task board”) and are directed to Campaigns or home.
- [ ] **Eligible individual user can bootstrap** — User with `profile_type = individual` and no workspace yet can open `/tasks` and get a creator workspace and personal board created; they then see their task board.
- [ ] **Dual-access user still sees switcher** — User with both creator and org workspaces sees the workspace switcher at `/` with “My tasks” and “Campaigns”; no regression.
- [ ] **No-access user does not gain unintended access** — User who is not eligible for creator bootstrap (e.g. org/project/company profile) and has no existing workspace must not see other users’ tasks or org data; they see the no-access / setup-needed flow only.

---

## 8. CRM task-board verification checklist

After deploy, verify creator task board and isolation:

- [ ] **Create task** — Log in as creator → Tasks → New task → submit; task appears in list and opens in detail.
- [ ] **Edit task** — On a **manual** task detail, edit title/description/platform/due date → Save; changes persist. Non-manual tasks must not show edit fields for title/description/platform/due.
- [ ] **Status change** — Change status (e.g. to_do → in_progress → submitted) on any task you can access; update succeeds.
- [ ] **Cross-user isolation** — As User A, create a task and note its ID. As User B (different account), open `/tasks/<User A's task ID>`; must get 404 or “not found”, not User A’s task. User B must not see User A’s tasks in the list.

---

## 9. M4 Org campaign dashboard verification checklist

After deploying the org campaign dashboard (M4):

- [ ] **Org-only user lands on /campaigns** — User with only org workspace(s) opens `/` and is redirected to `/campaigns`; they see the campaign list (or empty state) for their org workspaces only.
- [ ] **Creator-only user does not see org campaign data** — User with only a creator workspace who opens `/campaigns` is redirected to `/` (no org workspaces). They must not see any org campaigns or campaign detail URLs for workspaces they are not members of.
- [ ] **Dual-access user can enter org campaign view from switcher** — User with both creator and org workspaces sees the switcher at `/`; choosing “Campaigns” leads to `/campaigns` and the org campaign list.
- [ ] **Campaign detail is scoped to accessible org workspace only** — Opening `/campaigns/[id]` for a campaign in a workspace the user is not a member of returns 404. Only campaigns in the user’s org workspaces are visible.

---

## 10. Linkary sync + org submission review verification checklist

- [ ] **Real acceptance triggers sync** — Accept a job application (org job) as org owner/admin; sync runs after success. Campaign, participant, task bundle, and tasks appear in CRM. Acceptance response succeeds even if sync fails (sync is non-blocking).
- [ ] **Org → CRM workspace mapping resolves** — The org that owns the job has a CRM workspace with `linked_org_id` set to that org’s id. Sync receives `org_id` and resolves workspace correctly; no manual workspace_id needed.
- [ ] **Accepted creator sees synced tasks** — Accepted creator (profile_type = individual) sees generated tasks on **/tasks** (creator workspace is bootstrapped if needed; tasks are on their personal board). Non-eligible participant gets tasks on org board and is added as workspace member so they have access.
- [ ] **Repeated sync stays idempotent** — Trigger sync again with the same payload; no duplicate campaigns, participants, bundles, or tasks.
- [ ] **Org review still works** — Creator submits proof URL; org user can approve/reject/request revision on campaign detail. Unauthorized user cannot review; creator cannot review own submission.
- [ ] **No regression in apps/web acceptance flow** — Accepting an application still returns 200 and deal; no UI change; sync runs in background and does not block or alter the response.

---

## 11. RLS and access (reference)

- **First login / no CRM records:** Only **eligible** users (profile_type = individual) get a creator workspace and personal board via `getOrCreateCreatorWorkspaceAndBoard`; the `/tasks` page checks `canBootstrapCreatorWorkspace` before calling it. Ineligible users (org/project/company) see a no-access state on `/tasks` and do not get a creator workspace.
- **Create manual task:** Insert into `crm_tasks` with `workspace_id`/`board_id` from the creator’s workspace (RLS allows insert when workspace member).
- **Update task:** Server action loads the task by id (RLS: only if user can select it). Title/description/platform/due are applied only when `source_type = 'manual'`; status can always be updated by the user.
- **Task detail `/tasks/[id]`:** `getTask(supabase, id)` runs with the user’s session; RLS limits select to tasks in workspaces the user is a member of, or where they are assigned_to/created_by. Another user’s task returns null → notFound().

---

## 12. Optional: preview deployments

For PR previews, add in Supabase Redirect URLs (if you need auth on previews):

- `https://*.vercel.app/auth/callback`
