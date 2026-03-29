# Linkary CRM

Campaign operations and task workspace for **crm.linkary.xyz**. Isolated from the main Linkary app (`apps/web`).

## Stack

- Next.js 16 (App Router)
- Supabase (same project as Linkary; uses `crm_*` tables only)
- Tailwind CSS 4

## Setup

1. **Add Supabase env in the CRM app.** The CRM runs from `apps/crm` and does not load the repo root `.env`. Create `apps/crm/.env.local` with the same **`NEXT_PUBLIC_*`** values as your main Linkary app, and set **`NEXT_PUBLIC_APP_URL=http://localhost:3002`** for local magic-link redirects (do not leave this as `localhost:3000` from web).
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_APP_URL=http://localhost:3002
   ```
   (You can copy from `apps/web/.env.local` and override the app URL.)

2. Apply migrations (from repo root):
   ```bash
   pnpm db:push
   ```

3. Install and run:
   ```bash
   pnpm install
   pnpm --filter crm dev
   ```
   App runs at http://localhost:3002.

## Auth

Uses the same Supabase Auth project as Linkary. Sign in with magic link (same account as linkary.xyz). No code is shared with `apps/web`; CRM has its own Supabase client and auth callback.

## Authenticated report QA (Playwright)

Repeatable checks for `/campaigns/[id]/report` (Layer 1 copy, Section C column alignment, chart tooltips, console cleanliness). From repo root:

```bash
pnpm --filter crm dev          # terminal 1, or omit if already on :3002
pnpm --filter crm test:e2e     # terminal 2 (starts dev server automatically unless PLAYWRIGHT_NO_WEB_SERVER=1)
```

**Prerequisites**

- `apps/crm/.env.local` with `NEXT_PUBLIC_*` and **`NEXT_PUBLIC_APP_URL=http://localhost:3002`** (see [`.env.example`](./.env.example)).
- A Supabase user with **email + password** enabled (CRM UI is magic-link only; automation uses the password API). Set either `E2E_CRM_TEST_USER_EMAIL` / `E2E_CRM_TEST_USER_PASSWORD` or the same `E2E_TEST_USER_*` names used by `apps/web` (global setup also reads `apps/web/.env.local`).
- Optional: `CRM_E2E_CAMPAIGN_PROMOTED_SNAPSHOTS`, `CRM_E2E_CAMPAIGN_SPARSE`, `CRM_E2E_CAMPAIGN_PROOFS` for three distinct campaigns; default is the QA seed id `00000000-0000-4000-8000-00000000ca01` from `scripts/seedMultiUserContributionQa.ts`.

**Staging:** set `PLAYWRIGHT_CRM_BASE_URL=https://…` (HTTPS cookies use `secure: true` automatically).

**Manual magic-link session:** sign in once in Chromium, then `npx playwright codegen http://localhost:3002 --save-storage=apps/crm/.playwright/crm-auth-state.json` and point `playwright.config.ts` `storageState` at that file (same path as automated setup).

## Routes

- `/` — Redirects to `/login` or `/tasks`
- `/login` — Magic link sign-in
- `/tasks` — Task board (MVP M3)
- `/campaigns`, `/campaigns/[id]` — Campaign list and detail (M4)
- `/submissions` — Submissions queue (M5)
- `/reports` — Reports and export (M7)
- `/settings` — Workspace settings
- `/workspace/[slug]` — Workspace switcher

## Guardrails

- **No imports from `apps/web`.** CRM is self-contained.
- **No changes to Linkary.xyz** for CRM features; sync from Linkary is optional (M6) via API or worker.
