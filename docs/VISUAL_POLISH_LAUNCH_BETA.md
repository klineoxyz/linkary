# Visual polish pass — launch beta

**Goal:** Linkary + CRM read as one premium, light, orange-accent product family.  
**Not in scope:** Onboarding, referrals, data contracts, new features.

---

## 1) Audit summary

### Already visually solid (minimal change)
- **Linkary theme.css** — governed palette (#130600, #FF5300, radii).
- **Web shell** — light `#F7F8FB`, sidebar tokens.
- **Public profile** — existing public layout.

### Inconsistent / weak (addressed)
| Area | Issue | Change |
|------|--------|--------|
| **CRM** | OS dark mode flipped entire CRM to brown “admin night” | **Light-only CRM** (`color-scheme: light`; removed `prefers-color-scheme: dark` overrides). |
| **CRM** | White-on-white pages vs Linkary gray shell | **`--crm-page-bg: #f7f8fb`**, white cards, aligned with web. |
| **CRM** | Ad-hoc borders/radius/shadows | **Utility classes**: `crm-surface-card`, `crm-surface-raised`, `crm-surface-muted`, `crm-page-title`, `crm-btn-*`, `crm-input`. |
| **CRM** | Orange on every KPI number | **KPI values** use foreground; orange stays primary actions + accents. |
| **CRM nav** | Generic “CRM” block | **“Delivery workspace”** + copy aligned with linkary.xyz. |
| **Web profile** | Flat explainer strip | **Card + shadow** to match premium cards elsewhere. |
| **Deals / applications** | Flat list rows | **`shadow-sm`** on cards. |

### What was changed (high level)
- Single **CRM globals.css** token layer + component utilities.
- **DashboardShell, HomeShell, login, SetupRequired** — page bg + raised cards + nav hierarchy.
- **Tasks, task detail, task list/filters/bundles, CreateTaskModal** — surfaces + forms + buttons.
- **Campaigns list + detail** — page headers, tables, KPI cards, operator banner, submission row input.
- **Web:** profile explainer + gig deals + applications list polish.

---

## 2) Files touched

**CRM (`apps/crm`)**  
`src/app/globals.css`  
`src/components/DashboardShell.tsx`  
`src/components/HomeShell.tsx`  
`src/components/SetupRequired.tsx`  
`src/app/login/page.tsx`  
`src/app/login/LoginForm.tsx`  
`src/app/page.tsx`  
`src/app/(dashboard)/tasks/page.tsx`  
`src/app/(dashboard)/tasks/TasksList.tsx`  
`src/app/(dashboard)/tasks/TasksFilters.tsx`  
`src/app/(dashboard)/tasks/TasksOnboarding.tsx`  
`src/app/(dashboard)/tasks/CreateTaskButton.tsx`  
`src/app/(dashboard)/tasks/MyCampaignBundles.tsx`  
`src/app/(dashboard)/tasks/[id]/page.tsx`  
`src/app/(dashboard)/tasks/[id]/TaskDetailClient.tsx`  
`src/app/(dashboard)/campaigns/page.tsx`  
`src/app/(dashboard)/campaigns/[id]/page.tsx`  
`src/app/(dashboard)/campaigns/[id]/SubmissionReviewRow.tsx`  

**Web (`apps/web`)**  
`src/figma/app/App.tsx` (profile explainer)  
`src/components/profile-work/GigDealsPanel.tsx`  
`src/components/profile-work/MyApplicationsPanel.tsx`  

**Docs**  
`docs/VISUAL_POLISH_LAUNCH_BETA.md` (this file)

---

## 3) Migrations

**None.**

---

## 4) Design-system conventions

| Token / class | Role |
|---------------|------|
| `--crm-page-bg` | App canvas (#f7f8fb), matches Linkary shell. |
| `--crm-sidebar-bg` | White nav column. |
| `--crm-card` | White elevated surfaces. |
| `--crm-border`, `--crm-muted`, `--crm-foreground` | Text hierarchy. |
| `--crm-primary` (#ff5300) | Primary CTA, active nav, key links — not body text. |
| `--crm-radius` (0.625rem) | Cards, inputs, buttons. |
| `--crm-shadow-sm` / `--crm-shadow-card` | Restrained depth. |
| `crm-surface-card` | Default bordered card. |
| `crm-surface-raised` | Login / modals / hero blocks. |
| `crm-surface-muted` | Banners, empty strips, nested form areas. |
| `crm-page-title` / `crm-page-subtitle` | H1 + helper under CRM pages. |
| `crm-btn-primary` / `crm-btn-secondary` | CTA hierarchy. |
| `crm-input`, `crm-textarea`, `crm-select` | Focus ring uses primary tint. |

**Light-only CRM:** No automatic dark theme — avoids “second product” feel next to light Linkary.

---

## 5) Route-by-route visual QA

- [ ] **CRM /login** — card, inputs, success/error states.
- [ ] **CRM /** — chooser or CTA card.
- [ ] **CRM /tasks** — header, sync banner, filters, table, campaign cards.
- [ ] **CRM /tasks/[id]** — main card, proof form block, submissions list.
- [ ] **CRM /campaigns** — empty + table.
- [ ] **CRM /campaigns/[id]** — KPI row, banner, tables horizontal scroll.
- [ ] **Web /app/profile** — explainer card, tabs.
- [ ] **Web /app/profile/deals** — deal cards shadow.
- [ ] **Web /app/profile/applications** — application cards.

---

## 6) Mobile QA (320 / 375 / 390)

- [ ] CRM sidebar stacks; main padding readable.
- [ ] Task / campaign tables scroll inside card.
- [ ] Task detail form + proof block tappable.
- [ ] Login + home chooser fit width.
- [ ] Web profile explainer + tabs scroll horizontally if needed.

---

## 7) Regression checklist

- [ ] Auth, magic link, sign-out.
- [ ] Task create / submit proof / campaign review (functional).
- [ ] No reliance on dark mode in CRM.

---

## 8) Verdict

**Polished enough for invited beta** from a visual-family standpoint: CRM and Linkary now share **light shell, spacing, card logic, and orange-as-accent** discipline.

**Remaining visual debt (non-blocking):**  
- **Web** dashboard, analytics, profile edit, org workspace, public profile — larger surfaces; incremental alignment using same `rounded-xl` + `shadow-sm` + `bg-card` patterns as needed.  
- **CRM** campaign detail still dense on small screens (tables — acceptable with horizontal scroll).
