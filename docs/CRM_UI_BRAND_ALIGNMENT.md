# CRM UI brand alignment (Linkary design language)

CRM (crm.linkary.xyz) now uses the same design language as Linkary (linkary.xyz) so it feels like the operational extension of the main product, not a separate gray admin app.

---

## 1. UI audit summary

### Before (what differed from Linkary)

- **Palette:** CRM used a custom gray/slate theme (`--crm-bg: #f7f8fb`, `--crm-primary: #0f172a`, `--crm-muted: #64748b`, `--crm-border: #e5e7eb`). No orange; no shared tokens with apps/web.
- **Typography:** CRM used `system-ui`; Linkary uses Geist (via `--font-geist-sans`).
- **Navigation:** Sidebar showed all six items (Home, Tasks, Campaigns, Submissions, Reports, Settings), including placeholder-only tabs, which looked like full features.
- **Headings / body:** Many headings and labels used the same token as links (dark slate), so the UI felt flat and not clearly “Linkary” (no orange accent).

### After (what is aligned now)

- **Palette:** CRM uses Linkary’s palette: `--crm-primary: #FF5300`, `--crm-bg` / `--crm-card` match Linkary `--background` / `--card`, `--crm-border` and `--crm-muted` match Linkary’s border and muted-foreground. Light/dark supported via `prefers-color-scheme`.
- **Typography:** CRM layout loads Geist (same as apps/web); body uses `var(--font-geist-sans)`.
- **Branding:** “Linkary” is shown in orange in the logo line (“**Linkary** CRM”) on login, home header, and sidebar.
- **Hierarchy:** Page titles and section headings use `--crm-foreground`; links, primary buttons, and active nav use `--crm-primary` (orange). KPI values and CTAs stay orange where appropriate.
- **Navigation:** Only production-ready tabs are in the sidebar: Home, Tasks, Campaigns. Submissions, Reports, and Settings are hidden until implemented; routes remain for future use.
- **Empty / no-access states:** Copy tightened; CTAs use primary (orange) and primary-foreground; cards and borders use shared tokens.

---

## 2. Theme and tokens (CRM)

Defined in `apps/crm/src/app/globals.css`:

| Token | Light | Dark | Use |
|-------|--------|------|-----|
| `--crm-bg` | `#ffffff` | `#130600` | Page background |
| `--crm-card` | `#ffffff` | `#130600` | Cards, sidebar |
| `--crm-border` | `rgba(19,6,0,0.12)` | `rgba(255,255,255,0.12)` | Borders |
| `--crm-primary` | `#FF5300` | `#FF5300` | Links, primary buttons, active nav, accent |
| `--crm-primary-foreground` | `#ffffff` | `#ffffff` | Text on primary |
| `--crm-foreground` | `#130600` | `#ffffff` | Headings, body text |
| `--crm-muted` | `rgba(19,6,0,0.62)` | `rgba(255,255,255,0.65)` | Secondary text |
| `--crm-accent` | `rgba(255,83,0,0.10)` | `rgba(255,255,255,0.08)` | Hover backgrounds |

---

## 3. Sidebar / navigation (placeholder tabs)

- **Visible in nav:** Home, Tasks, Campaigns only.
- **Hidden from nav:** Submissions, Reports, Settings (placeholder pages only). Routes `/submissions`, `/reports`, `/settings` are unchanged so they can be re-enabled when features ship.
- **Change:** `apps/crm/src/components/DashboardShell.tsx` — `nav` array reduced to the three items above; no “Coming soon” labels in the sidebar to avoid clutter.

---

## 4. Verification checklist

Use this after any CRM UI or theme change.

- [ ] **CRM visually matches Linkary** — Primary orange (#FF5300) appears on login, sidebar “Linkary” label, primary buttons, active nav item, and links. Background/card/border match Linkary light (and dark if enabled). Typography uses Geist.
- [ ] **Functional tabs still work** — Home (switcher / no workspace), Tasks (list, create, detail, status, proof submission), Campaigns (list, detail, submission review) behave as before. No change to backend, RLS, or sync.
- [ ] **Placeholder tabs hidden** — Submissions, Reports, Settings do not appear in the sidebar. Direct URL to `/submissions`, `/reports`, or `/settings` still renders the existing placeholder page (no 404).
- [ ] **No backend regression** — Auth, role-aware routing, creator bootstrap, task board, submission flow, org review, and Linkary → CRM sync are unchanged. No edits to `apps/crm/src/lib/*`, `apps/crm/src/app/api/*`, or RLS.

---

## 5. Backend and scope

- **Unchanged:** All logic in `lib/` (access, sync, workspace, tasks, campaigns, submissions), API routes, Supabase RLS, and apps/web.
- **Scope of changes:** `apps/crm` only — `globals.css`, `layout.tsx`, `DashboardShell`, `HomeShell`, login page, home page, tasks and campaigns pages and their subcomponents, `CreateTaskButton`, `TaskDetailClient`, `TasksList`, `TasksFilters`, `SetupRequired`. Placeholder pages (submissions, reports, settings) were not redesigned; only nav visibility was changed.
