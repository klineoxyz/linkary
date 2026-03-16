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
| `NEXT_PUBLIC_COOKIE_DOMAIN`    | `.linkary.xyz`           | Share auth with linkary.xyz. Set in **both** Vercel projects (web + CRM). |

Apply to **Production**, **Preview**, and **Development** as needed.

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
- [ ] **Unauthorized user** — User with no CRM workspaces sees the “No CRM access yet” / setup-needed page at `/`; they must not see other users’ tasks or org data. “Set up my task board” leads to `/tasks` and bootstraps creator workspace.

---

## 7. CRM task-board verification checklist

After deploy, verify creator task board and isolation:

- [ ] **Create task** — Log in as creator → Tasks → New task → submit; task appears in list and opens in detail.
- [ ] **Edit task** — On a **manual** task detail, edit title/description/platform/due date → Save; changes persist. Non-manual tasks must not show edit fields for title/description/platform/due.
- [ ] **Status change** — Change status (e.g. to_do → in_progress → submitted) on any task you can access; update succeeds.
- [ ] **Cross-user isolation** — As User A, create a task and note its ID. As User B (different account), open `/tasks/<User A's task ID>`; must get 404 or “not found”, not User A’s task. User B must not see User A’s tasks in the list.

---

## 7. RLS and access (reference)

- **First login / no CRM records:** Creator gets a workspace and personal board via `getOrCreateCreatorWorkspaceAndBoard` (RLS allows insert when `owner_profile_id = auth`).
- **Create manual task:** Insert into `crm_tasks` with `workspace_id`/`board_id` from the creator’s workspace (RLS allows insert when workspace member).
- **Update task:** Server action loads the task by id (RLS: only if user can select it). Title/description/platform/due are applied only when `source_type = 'manual'`; status can always be updated by the user.
- **Task detail `/tasks/[id]`:** `getTask(supabase, id)` runs with the user’s session; RLS limits select to tasks in workspaces the user is a member of, or where they are assigned_to/created_by. Another user’s task returns null → notFound().

---

## 9. Optional: preview deployments

For PR previews, add in Supabase Redirect URLs (if you need auth on previews):

- `https://*.vercel.app/auth/callback`
