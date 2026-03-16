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
2. **Import** the same GitHub repository you use for linkary.xyz (e.g. `klineoxyz/linkary`).
3. Configure the project:
   - **Project Name:** e.g. `linkary-crm`.
   - **Root Directory:** set to **`apps/crm`** (not the repo root).
   - **Framework Preset:** Next.js (auto-detected).
   - **Build Command:** leave default (`next build`).
   - **Output Directory:** leave default (`.next`).
   - **Install Command:** leave default (`pnpm install` or `npm install`; if root is monorepo with pnpm, Vercel usually runs install from repo root).

4. If the repo root has `pnpm-workspace.yaml`, ensure the build runs from repo root so `pnpm install` installs all workspace packages, and the build is run in the context of `apps/crm`. In Vercel, setting **Root Directory** to `apps/crm` can change the install context; if build fails, try:
   - **Root Directory:** leave empty (repo root), then set **Build Command** to `cd apps/crm && pnpm install && pnpm build`, and **Output Directory** to `apps/crm/.next` (or adjust to match Next.js output).
   - Or keep **Root Directory:** `apps/crm` and ensure Vercel uses the root `package.json` for install (e.g. via "Override" for Install Command: `pnpm install --filter crm` or from root).

   Recommended: set **Root Directory** to **`apps/crm`** and in **Settings → General** set **Install Command** to `pnpm install` (Vercel will run it in `apps/crm`; if the app has its own `package.json` there, it works). If you hit workspace dependency issues, use **Root Directory** empty and custom build command above.

5. Deploy. Fix any env or build errors before adding the domain. If build fails with workspace deps, use **Root Directory** empty and **Build Command:** `pnpm install && pnpm --filter crm build`, **Output Directory:** `apps/crm/.next` if needed.

---

## 2. Required env vars (CRM project)

In the CRM Vercel project → **Settings → Environment Variables**, add:

| Name                           | Value                    | Notes                    |
|--------------------------------|--------------------------|--------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`     | `https://xxx.supabase.co`| Same as linkary.xyz      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| (anon key)               | Same as linkary.xyz      |

Use the **same** Supabase project as linkary.xyz. No need to expose the service role key unless you add server-only sync features later.

Apply to **Production**, **Preview**, and **Development** as needed.

---

## 3. Namecheap DNS (crm subdomain)

Domain is managed in **Namecheap**. Existing **@** and **www** records stay as they are.

Add **one** new record:

| Type  | Host | Value                          | TTL        |
|-------|------|--------------------------------|------------|
| CNAME | crm  | *(exact Vercel target below)*  | Automatic  |

**Value (CNAME target):**

1. In Vercel, open the **CRM project** → **Settings → Domains**.
2. Add domain: **crm.linkary.xyz**.
3. Vercel will show a **target** for the CNAME, e.g. `cname.vercel-dns.com` or a project-specific target like `linkary-crm-xxx.vercel.app`.
4. Copy that **exact** value into Namecheap as the CNAME **Value** for host **crm**.

**Do not change** existing **@** (A/ALIAS) or **www** (CNAME) records.

---

## 4. Supabase auth redirect URLs

In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication → URL Configuration**:

- **Redirect URLs:** add  
  **`https://crm.linkary.xyz/auth/callback`**

Keep existing linkary.xyz redirect URLs. Save.

---

## 5. Post-deploy verification checklist

- [ ] **CRM build passes** — Vercel build for the CRM project completes successfully.
- [ ] **Domain verified** — In Vercel → Domains, `crm.linkary.xyz` shows as Verified (may take a few minutes after DNS propagates).
- [ ] **crm.linkary.xyz loads** — Opening `https://crm.linkary.xyz` shows the CRM app (login or redirect to login/tasks).
- [ ] **Auth callback works** — Sign in (e.g. magic link) and confirm redirect to CRM and session works; no redirect to linkary.xyz.
- [ ] **No changes to apps/web** — linkary.xyz still works as before; no regression on the main app.

---

## 6. Optional: preview deployments

For PR previews, Vercel will assign a URL like `linkary-crm-xxx.vercel.app`. To test magic link on previews, add a wildcard in Supabase Redirect URLs, e.g.:

- `https://*.vercel.app/auth/callback`

(Only if you need auth on preview deployments.)
