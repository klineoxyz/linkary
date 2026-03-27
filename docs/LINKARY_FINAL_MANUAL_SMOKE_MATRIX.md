# Linkary — final manual smoke matrix

## SMOKE TEST CONTEXT

- **Tester:** `________________`
- **Browser:** `________________` (name + version, e.g. Chrome 134)
- **Device:** `________________` (e.g. Windows desktop, macOS laptop)
- **Environment:** `________________` (e.g. Production — Web `https://linkary.xyz`, CRM `https://crm.linkary.xyz`)
- **Date:** `________________`

**Note:** After changing **public visibility** toggles on `/app/profile/edit`, **hard refresh** the public `/{username}` page (and re-inspect the related network response, e.g. `GET /api/public/profile?username=…`) before marking **Pass/Fail**. Cached HTML or API responses can look “stale” until refresh.

**Pre-flight:** confirm `NEXT_PUBLIC_COOKIE_DOMAIN` matches your apex (e.g. `.linkary.xyz`) on **both** web and CRM deployments if you expect shared session.

---

## ACCOUNT SET

Prepare accounts (tick when ready):

- [ ] **Creator** — `________________` (email / handle)
- [ ] **Org admin** — `________________`
- [ ] **Org member** — `________________`
- [ ] **Outsider / non-member** — `________________` (no workspace access)
- [ ] **Comped or override-plan** (if available) — `________________`

Pick one **published public slug** for toggle tests: `@________________`

---

## 1. PROFILE TRUTH

**Canonical expectations**

- **Private / self-only:** no email, wallet, or internal IDs on public `/{username}` or in `GET /api/public/profile?username=…` JSON.
- **Public toggles:** edits on `/app/profile/edit` show on `/{username}` after save (and cache if any).
- **Analytics visibility:** with `analytics_visibility = private`, public page / public API must not expose follower/analytics fields that DB view gates (see `public_profile_view`).
- **Pricing / location:** only when `meta.public_location` / `meta.public_pricing` allow; otherwise hidden on public payload.
- **Owner preview:** `GET /api/me/public-preview?slug=<your-slug>` (authenticated owner only) should align with public rendering rules for published content (owner may see unpublished preview; compare field presence vs public when published).

### 1.1 Creator

| Route | Check | Expected | Actual | Pass/Fail | Notes |
|-------|--------|----------|--------|-----------|-------|
| `/app/profile` | Signed in | Dashboard shows your profile summary; no raw UUIDs in UI as primary identity | | | |
| `/app/profile/edit` | Save toggles | Location/pricing/analytics visibility persist | | | |
| `/{username}` | Logged out (or incognito) | Public fields only; toggles respected | | | |
| `/{username}` | Private data | No email / wallet / deal ids in page source or network JSON | | | |
| API | `GET /api/public/profile?username=…` | Same as public page contract; no forbidden keys | | | |
| API | `GET /api/me/public-preview?slug=…` | 200 for owner + slug match; shape consistent with public rules for preview | | | |

### 1.2 Org admin / Org member / Outsider

| Actor | Route | Check | Expected | Actual | Pass/Fail | Notes |
|-------|-------|--------|----------|--------|-----------|-------|
| Org admin | `/{slug}` | Public org or profile | Same visibility rules as creator where applicable | | | |
| Org member | `/{slug}` | — | — | | | |
| Outsider | `/{slug}` | — | Same as any anonymous viewer; no extra private fields | | | |

*(Repeat or mark N/A if org uses only company pages.)*

---

## 2. AUTH / SESSION CONTINUITY

| Actor | Scenario | Expected | Actual | Pass/Fail | Notes |
|-------|----------|----------|--------|-----------|-------|
| Any | **Web → CRM** | Sign in on **web**; open **CRM** in same browser → still authenticated (no second magic link if cookie domain is correct) | | | |
| Any | **CRM → Web** | Sign in on **CRM**; open **web** → still authenticated | | | |
| Any | Magic link **callback** | After email link, land on intended app path; no infinite redirect | | | |
| Any | **Session persists** | Refresh both apps; session remains until sign-out | | | |
| Ops (if applicable) | **Role** | Non-ops user must not see CRM `/ops/*`; ops user sees ops nav only when `internal_ops_members` row exists | | | |

---

## 3. CRM ACCESS

**Test campaign:** use a real `campaign_id` in your org workspace: `________________`

**CRM outsider expectation:** A user who is **not** a member of the campaign’s workspace must **not** see **campaign title**, **metrics**, **submissions**, **participant data**, or **any org-private campaign information** (UI, HTML source, or XHR/API responses). Expect **404**, empty list, or equivalent **no-access** behavior — never partial leaks.

| Actor | Route | Expected | Actual | Pass/Fail | Notes |
|-------|-------|----------|--------|-----------|-------|
| **Org admin** | `/campaigns` | Sees org campaigns for workspaces they belong to | | | |
| **Org admin** | `/campaigns/[id]` | Loads campaign; can see operator controls as designed | | | |
| **Org admin** | `/campaigns/[id]/report` | Report loads (or clear empty state) | | | |
| **Org admin** | `/campaigns/[id]/case-study` | Case study loads | | | |
| **Org member** | `/campaigns` | Sees campaigns for member workspaces | | | |
| **Org member** | `/campaigns/[id]` | Access if RLS allows member on that workspace | | | |
| **Org member** | `/campaigns/[id]/report` | Same | | | |
| **Org member** | `/campaigns/[id]/case-study` | Same | | | |
| **Outsider** | `/campaigns/[id]` (direct URL) | No access; **no** title / metrics / participants / submissions / org-private data | | | |
| **Outsider** | `/campaigns/[id]/report` | Same | | | |
| **Outsider** | `/campaigns/[id]/case-study` | Same | | | |

---

## 4. ENTITLEMENT / GATING

**Cross-user analytics URL (web):** `/app/analytics/profile/<username>` (or your routed path) and API `GET /api/me/analytics/profile/<username>`.

| Actor | Plan state | Route / surface | Expected | Actual | Pass/Fail | Notes |
|-------|------------|-----------------|----------|--------|-----------|-------|
| Creator | **Free** | Cross-user analytics | Locked or 403; upgrade / pricing CTA truthful | | | |
| Creator | **Paid (KOL+)** | Cross-user analytics | Unlocked; allowlisted metrics only | | | |
| Creator | **Comp (`analytics_full`)** | Cross-user analytics | Unlocked without paid plan | | | |
| Creator | **Plan override** | Plans UI + gated features | Effective plan matches ops override | | | |
| Creator | **Free** | Discovery / marketplace (if gated) | Blocked or limited per product | | | |
| Creator | **Paid** | Same | Unlocked per plan | | | |

---

## 5. PRINT / PDF

**Route:** `/campaigns/[id]/case-study` (CRM)

| Actor | Check | Expected | Actual | Pass/Fail | Notes |
|-------|--------|----------|--------|-----------|-------|
| Org admin or member | **Print preview** (Ctrl/Cmd+P) | Chrome/Edge print preview shows content; app chrome hidden where `@media print` applies | | | |
| Same | **Save as PDF** | PDF saves; no blank first page only | | | |
| Same | **Layout** | No critical clipping; sections readable | | | |
| Same | **Tables** | Wide tables wrap or shrink; proof URLs break/wrap | | | |
| Same | **Charts / KPIs** | SVG/charts and KPI cards readable in grayscale | | | |

---

## FINAL

**Blockers:**  
*(Issues that must be fixed before launch — list below)*


**Non-blockers:**  
*(Cosmetic, copy, or follow-up)*


**Go / No-go:**  
- [ ] **GO** — all blockers cleared; matrix complete for target environment  
- [ ] **NO-GO** — blockers remain: `________________`

---

## ISSUE LOG FORMAT

Use one block per issue found during this matrix:

- **Severity:** `Blocker` / `High` / `Medium` / `Low`
- **Actor:** `________________`
- **Route:** `________________`
- **Expected:** `________________`
- **Actual:** `________________`
- **Owner:** `________________`
- **Fix required before launch:** `Yes` / `No`

**Sign-off**

| Role | Name | Date |
|------|------|------|
| QA | | |
| Ops | | |
