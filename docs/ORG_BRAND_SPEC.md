# Org / Brand Creation & Management — Product Spec

## PART 1 — Product Model (Decisive)

| Concept | Definition |
|--------|------------|
| **Personal profile** | One per user (`profiles`). The individual. `account_type`: `individual` or `company` (onboarding; does not restrict org creation). |
| **Brand profile** | An org with `org_type = 'brand'`. Public page at linkary.xyz/@slug. Has name, handle, X verification, optional tagline/website. |
| **Org** | Any non-person entity in `orgs`: `company`, `brand`, `project`, `agency`. One table; no separate brands table. |

**Decisions:**
- **Any user can create a brand/org:** Yes. No restriction by account_type. Creator becomes **owner** (default owner/admin).
- **Company account:** A user with `account_type = 'company'`. can manage **multiple orgs** (brands, projects, agencies). Same org model; no separate “company” entity; the user is the company and owns many orgs.
- **Same underlying model:** Orgs only. Brand = org with type `brand`. No second table.
- **Owner on creation:** RPC `create_org_and_membership`: inserts org + one `org_members` row with role `owner`; `orgs.owner_profile_id = auth.uid()`.
- **Official linking:** Create flow asks to connect official X (required for verification). Stored on org: `x_account_username`, `x_connected_at`, `is_x_verified`. Optional: website, twitter_username.
- **Team/admin:** `org_members`: roles `owner` \| `admin` \| `member`. Owner cannot leave. Up to 3 admins. Managed in org → Members tab.
- **Context switching:** Header shows current context (profile vs org). User explicitly chooses “My profile” or an org from “My Orgs”; no “slug matches profile” auto-selection.

---

## PART 2 — Ideal UX Flows

### A. Individual creates a Brand Profile
- **Entry:** Dashboard → “Create Org” or “Create Brand”.
- **Steps:** (1) Name + handle (slug), type = Brand. (2) Connect official X account. (3) Optional: tagline, website.
- **Required:** name, handle, X connected (to verify).
- **Result:** Org created; user is owner. **Land on that org’s dashboard.** Copy: “You’re managing: [Name]”.

### B. Individual creates an Org (project/agency/company)
- Same as A; type selector: Brand / Project / Agency / Company. Rest identical.

### C. Company (user) creates multiple brands
- **Access:** Dashboard → “My Orgs” (list of all orgs they own or admin). “Create Org” adds another.
- **List:** All orgs; no “first org” or “matching slug” default. User always picks which org to open.
- **Add admins:** Per org → Members tab.

### D. Admin management
- **Add admin:** Members tab → username + role (Admin/Member). Cap: 3 admins.
- **Remove:** Non-owner can be removed; owner cannot leave (only transfer).
- **Permissions:** Owner = full; Admin = add members, jobs, edit org; Member = view.

### E. Context switching
- **UI:** Header or nav shows current context (e.g. “DESI Crypto CLUB” or “My profile”). Switcher: “My profile” | “[Org 1]” | “[Org 2]”.
- **No magic:** User always chooses which org they’re managing; no fallback to “org whose slug matches profile”.

---

## PART 3 — Information Architecture

| Item | Location |
|------|----------|
| Create Org/Brand | Dashboard (primary): “My Orgs” card → “Create Org”. Single flow. |
| My Orgs/Brands | Dashboard only: “My Orgs” list. No duplicate “Admins & team” that jumps to an org by slug. |
| Org settings | Each org → Settings tab (name, handle, X, public listing, etc.). |
| Admin/team | Each org → Members tab. |
| Public URL | linkary.xyz/@org_slug for all orgs (brand/project/agency/company). Same layout. |

---

## PART 4 — Technical Plan

- **Tables:** Keep `orgs`; no new table. `org_members` unchanged. `orgs.owner_profile_id` = creator.
- **Create flow:** One modal/page: name (required), handle/slug (required), type (brand/project/agency/company). On submit → create org via RPC → redirect to org dashboard with prompt “Connect X to verify” (or inline connect-X step before submit; current flow creates then connects).
- **APIs:** Existing: `create_org_and_membership`, `POST/GET /api/orgs/[id]/members`, etc. No new routes.
- **Files to change:**
  - `CreateOrgModal.tsx`: Full form (name, slug, type) again; no “Connect X only” minimal create. After create, redirect to org and show connect-X in Settings if not verified.
  - `App.tsx` (Profile): “Admins & team” → go to **Dashboard** (user sees My Orgs and picks), or open a small “Your orgs” list and pick; **remove** “prefer org where slug === profile username”.
  - `OrgDetailPage.tsx`: Remove “your profile @X doesn’t match this org @Y” as primary UX; optional small info only. Always show “Managing: [Org name]”.
  - `DashboardPage.tsx`: My Orgs = single source; ensure “Create Org” uses new create flow.
- **RLS:** No change; existing org + org_members policies stay.

---

## PART 5 — Migration / Cleanup

| Remove / Retire | Replace With |
|-----------------|--------------|
| Profile “Admins & team” choosing org by matching slug | “Admins & team” → Dashboard (My Orgs) or explicit org list to choose |
| Members tab “set handle to match your profile” as main message | Keep org name/handle in Settings; drop profile-mismatch copy as primary CTA |
| CreateOrgModal “Connect X only” creating “My org” + random slug | Full create: name, handle, type; then create; then connect X on org page if needed |
| Any “first org” or “matching org” fallback when opening Members | User always selects org from My Orgs list |

- **Existing orgs:** No migration. Keep all rows.
- **Existing memberships:** Unchanged.

---

## PART 6 — Implementation Order

| Priority | What |
|----------|------|
| **P0** | Create flow: name, handle, type (required); create org; land on org dashboard; connect X in org Settings if not verified. |
| **P0** | Dashboard: My Orgs only; “Create Org” uses new flow. Profile “Admins & team” → Dashboard (no slug-match). |
| **P0** | Org detail: Always “Managing: [Org name]”; remove profile-mismatch as main UX. |
| **P1** | Context switcher in header (profile vs org). |
| **P1** | Create flow: optional tagline, website; optional “connect X now” step in modal. |
| **P2** | Multi-step wizard, empty-state copy, analytics. |

---

## Summary

- **One model:** Orgs (brand/project/agency/company). Creator = owner. Company user = can have many orgs.
- **One create flow:** Name + handle + type → create → land on org; connect X in Settings.
- **One place for “my orgs”:** Dashboard. No slug-matching; user picks org explicitly.
- **Clear context:** Every org page shows “Managing: [Org name]”. No hidden assumptions.
