# Vercel "Internal Error" During Deploying Outputs

If the build completes but **Deploying outputs...** fails with *"We encountered an internal error. Please try again"*:

## 1. Config change (done)

- `apps/web/vercel.json` has `"framework": "nextjs"` so Vercel treats the output correctly. Redeploy after this change.

## 2. Plan / function count

- This app has **many API routes** (100+). On the **Hobby** plan, Vercel allows only **12 serverless functions** per deployment. Exceeding that can produce a generic "internal error" during the deploy step.
- **Fix:** Upgrade to **Pro** (or use a team) if you need all API routes. Or reduce the number of serverless functions (e.g. consolidate routes).

## 3. Retry and cache

- **Redeploy** once or twice (transient errors are common).
- In Vercel: **Project → Settings → General → Build Cache** → clear or disable, then redeploy.

## 4. Root directory

- If this repo is a **monorepo**, set **Root Directory** to `apps/web` in **Project → Settings → General** so the build and output paths are correct.

## 5. “We encountered an internal error” during Deploying outputs

If the build completes but **Deploying outputs...** then fails with *"We encountered an internal error. Please try again"*:

- This is often a **Vercel-side** issue (transient or plan limit). The app has 170+ API routes (serverless functions). On **Hobby** you get only **12 functions** per deployment — upgrade to **Pro** or reduce function count.
- **Retry** the deploy once or twice; clear **Build Cache** in Project → Settings → General, then redeploy.
- Ensure **Root Directory** is `apps/web` for this monorepo.

## 6. Support

- [Vercel Status](https://status.vercel.com) for outages.
- If it still fails, contact Vercel Support with the deployment URL and the log snippet where "Deploying outputs" fails.
