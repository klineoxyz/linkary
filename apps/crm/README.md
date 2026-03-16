# Linkary CRM

Campaign operations and task workspace for **crm.linkary.xyz**. Isolated from the main Linkary app (`apps/web`).

## Stack

- Next.js 16 (App Router)
- Supabase (same project as Linkary; uses `crm_*` tables only)
- Tailwind CSS 4

## Setup

1. **Add Supabase env in the CRM app.** The CRM runs from `apps/crm` and does not load the repo root `.env`. Create `apps/crm/.env.local` with the same values as your main Linkary app:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
   (Copy from `apps/web/.env.local` if you have it.)

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
