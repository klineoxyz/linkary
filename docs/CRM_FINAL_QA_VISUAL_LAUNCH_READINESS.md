# CRM final visual QA and launch readiness

Final pass: apps/crm only. No backend, sync, auth, or RLS changes. No apps/web changes.

---

## 1. Final QA summary

- **Goal 1 — CRM feels like Linkary.xyz:** Primary orange (#FF5300), same foreground/muted/border tokens, Geist typography, and “Linkary” in orange in header/sidebar/login. All non-palette colors were removed so only Linkary-allowed tokens are used.
- **Goal 2 — Visual consistency:** Status badges, buttons, form messages, and empty/placeholder copy now use CRM tokens only. Placeholder routes show a clear “Coming soon” line when visited directly.
- **Goal 3 — Backend unchanged:** No edits to `lib/`, `app/api/`, or any server logic. Only UI components and styles were touched.

---

## 2. What was still visually inconsistent (and is now fixed)

| Location | Inconsistency | Fix |
|----------|----------------|-----|
| **LoginForm** | Success/error messages used `text-red-600` / `text-green-600` (outside Linkary palette) | Error: `text-[var(--crm-foreground)]`. Success: `text-[var(--crm-muted)]`. |
| **TasksList** | Task status badges used Tailwind gray/sky/amber/purple/green/red/emerald | Replaced with `statusBadgeClass()` using only `--crm-accent`, `--crm-primary`, `--crm-muted`, `--crm-bg`, `--crm-foreground`. |
| **TaskDetailClient** | Submission history badges (green/red/amber/gray), rejection text and error messages in red | Badges use CRM accent/muted/bg; rejection and error text use `--crm-foreground`. |
| **SubmissionReviewRow** | Status badge and Approve/Reject/Needs revision buttons in green/red/amber; error in red | Status badge: CRM tokens. Approve = primary; Reject = muted tint; Needs revision = accent. Error = foreground. |
| **Campaign detail (KpiCard)** | “(no data yet)” and no-metrics message in `text-amber-600` | Both use `text-[var(--crm-muted)]`. |
| **CreateTaskButton** | Form error in `text-red-600` | `text-[var(--crm-foreground)]`. |
| **Placeholder pages** (/submissions, /reports, /settings) | H1 in primary (orange); no “coming soon” on direct visit | H1 set to `--crm-foreground`; added short “Coming soon” line so direct visit looks intentional. |
| **SubmissionReviewRow** | Review note input had no explicit text/placeholder/background | Added `text-[var(--crm-foreground)]`, `bg-[var(--crm-card)]`, `placeholder:text-[var(--crm-muted)]`. |

---

## 3. What was fixed (list)

1. **Login** — Form feedback uses design tokens only.
2. **Tasks list** — All task status badges use CRM tokens (accent for positive/in-progress, muted for neutral, muted tint for rejected).
3. **Task detail** — Submission history badges and all error/rejection text use CRM tokens; Submit proof form unchanged in behavior.
4. **Campaign detail** — KPI “no data yet” and “Stored metrics not yet available” use muted; submission review row status badge and action buttons (Approve / Reject / Needs revision) use primary, muted tint, and accent; review note input and error use foreground/card/muted.
5. **Create task modal** — Error message uses foreground.
6. **Placeholder routes** — Submissions, Reports, Settings: title in foreground, “Coming soon” line added; nav remains unchanged (tabs still hidden).

---

## 4. Verification: key screens vs Linkary

| Screen | Outcome |
|--------|--------|
| **Login** | Linkary in orange, card/border/input/button use CRM tokens; message text in foreground/muted. |
| **Home / switcher / no-access** | Same tokens; primary CTA; no non-palette colors. |
| **Sidebar** | Linkary in orange; active = primary; hover = accent; only Home, Tasks, Campaigns. |
| **Tasks list** | Table and status badges use CRM tokens only. |
| **Task detail** | Headings/body in foreground; links/primary buttons in primary; status and submission badges in tokens; errors in foreground. |
| **Campaigns list** | Headings and table use foreground/muted; campaign link in primary. |
| **Campaign detail** | KPIs, sections, tables, submission review badges and buttons use CRM tokens; no amber/red/green. |
| **Placeholder pages** | H1 in foreground; “Coming soon” text; no nav re-added. |

---

## 5. Dark mode

- CRM `globals.css` already supports `prefers-color-scheme: dark` with the same token names (background, card, border, foreground, muted, accent, primary). All updated components use these variables, so dark mode stays consistent with Linkary’s design language without further changes.

---

## 6. Confirmation: no backend behavior changed

- **Not modified:** `apps/crm/src/lib/*`, `apps/crm/src/app/api/*`, Supabase RLS, auth flow, role-aware routing, creator bootstrap, task/campaign/submission logic, Linkary → CRM sync.
- **Modified:** Only UI in `apps/crm` — login page, HomeShell, DashboardShell, home page, tasks (list, detail, CreateTaskButton, TasksList, TasksFilters, TaskDetailClient), campaigns (list, detail, SubmissionReviewRow, KpiCard), placeholder pages (submissions, reports, settings), SetupRequired. No changes in `apps/web`.
