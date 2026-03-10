# Linkary: Entity-Bound Slug Ownership Policy

**Purpose:** Define and enforce that slug ownership is **entity-bound** (profile or org), not session-bound. Once a slug is claimed by an entity type during onboarding, login, or org creation, it remains owned by that type unless explicitly migrated through an intentional admin/manual transfer flow.  
**References:** `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md`, `LINKARY_NAMESPACE_REMEDIATION_AND_BACKFILL_PLAN.md`.

---

## 1. Rule Definition

### 1.1 Core rule

**Slug ownership is entity-bound, not session-bound.**

- A slug belongs to exactly one **owner_type**: `profile` or `org`, and one **owner_id** (the profile id or org id).
- The **usernames** table is the source of truth: each row has `(username, owner_type, owner_id)`. No slug may appear with more than one owner.
- Public and in-app routing **must always resolve** according to that `owner_type`. A later login, signup, or claim by a different entity type **must not** silently reuse or reinterpret the slug.
- **Claim context determines ownership:** During onboarding, signup, X login, profile username claim, or org creation/slug claim, the **entity type of the claim** (profile vs org) determines who owns the slug. Once claimed, the slug cannot be claimed by the other entity type through normal claim or update flows.

### 1.2 Strict formulation (founder recommendation)

- **Slug claimed as org** → stays org. No profile may take it via onboarding, login, or profile edit.
- **Slug claimed as profile** → stays profile. No org may take it via org create or org slug update.
- **Transfer** between profile and org is allowed **only** through a **manual admin migration process** with audit trail, never during login or onboarding.

---

## 2. Resolver Behavior

### 2.1 Public root: `/:segment`

- **Source of truth:** Resolve **only** from the **usernames** table: one lookup by normalized segment → `owner_type` + `owner_id`.
- **Behavior:** If a row exists with `username = normalized(segment)`:
  - `owner_type = 'profile'` → load that profile; serve **public user profile** at `/:segment` (canonical, indexable).
  - `owner_type = 'org'` → load that org; serve **public org profile** at `/:segment` (canonical, indexable).
- **No fallback by session:** A user logging in as a profile must not cause `/:segment` to “become” a profile page if the slug is owned by an org in usernames, and vice versa. Resolution is **independent of the current session**.

### 2.2 In-app user route: `/u/:username`

- **Scope:** Only for **profile-owned** slugs.
- **Behavior:** Resolve `username` via usernames (or profiles) to a **profile**. If the slug is owned by an org in usernames, do **not** serve profile data; **redirect (302) to the public canonical route `/:segment`** (see wrong-type policy below). In-app user analytics and auth-gated profile views apply only when the slug is profile-owned.

### 2.3 In-app org route: `/org/:slug`

- **Scope:** Only for **org-owned** slugs.
- **Behavior:** Resolve `slug` via usernames (or orgs) to an **org**. If the slug is owned by a profile in usernames, do **not** serve org data; **redirect (302) to the public canonical route `/:segment`** (see wrong-type policy below). In-app org analytics and auth-gated org views apply only when the slug is org-owned.

### 2.4 Wrong-type in-app route policy (final)

When an in-app route is requested for a slug that is owned by the **other** entity type (e.g. `/u/desicryptoclub` but slug is org-owned, or `/org/desicryptoclub` but slug is profile-owned), the app must **redirect to the public canonical route** `/:segment`, not return 404.

- **Choice: redirect (302) to `/:segment`.**
- **Rationale:** (1) **UX** — The user sees the correct content (public profile or public org) instead of a dead 404. (2) **Canonical** — The public URL is the single source of truth for that slug; redirecting there keeps one canonical destination. (3) **Links** — Shared or bookmarked wrong-type URLs (e.g. `/u/desicryptoclub` when it’s an org) still resolve to the right page. (4) **SEO** — Redirect to canonical is standard; 404 would waste crawl and confuse indexing.
- **Implementation:** Resolve segment from usernames; if `owner_type` does not match the route (profile for `/u/*`, org for `/org/*`), respond with **302 Redirect** to `/{segment}`. Do not serve the wrong entity type and do not return 404 for wrong-type.

### 2.5 Summary table

| Route           | Resolves from | Allowed owner_type | If wrong type |
|-----------------|---------------|--------------------|----------------|
| `/:segment`     | usernames     | profile or org     | N/A (single owner) |
| `/u/:username`  | usernames     | profile only       | **302 redirect to `/:segment`** (public canonical) |
| `/org/:slug`    | usernames     | org only           | **302 redirect to `/:segment`** (public canonical) |

---

## 3. Claim Behavior

### 3.1 At claim time

- **Profile claims** (onboarding, signup, X login sync, profile edit “username”): Call `claim_username_for_profile(desired_username)`. The RPC inserts/updates **usernames** with `owner_type = 'profile'` and `owner_id = profile_id`. If the slug is already in usernames with `owner_type = 'org'`, the claim **must fail** (e.g. `USERNAME_TAKEN_VERIFIED` or equivalent). No silent takeover.
- **Org claims** (org creation, org slug update): Must go through a path that checks and writes **usernames** (e.g. `claim_username_for_org(desired_slug, org_id)` or equivalent in `create_org_and_membership`). If the slug is already in usernames with `owner_type = 'profile'`, the claim **must fail**. No silent takeover.

### 3.2 After claim

- **Once claimed**, the slug is bound to that entity type. Normal “claim” or “update slug” flows for the **other** entity type must not overwrite or reassign it.
- **Re-claim by same entity:** Same profile re-claiming the same username, or same org re-claiming the same slug, is idempotent (no-op or success). Changing to a **different** slug is allowed (release old, claim new) within the same entity type, subject to uniqueness and reserved-path rules.

### 3.3 No accidental transfer

- **Login** must never change ownership. A user logging in with X handle `desicryptoclub` must not cause the slug to move from org to profile (or vice versa) if it is already owned by the other type in usernames.
- **Onboarding** (profile) must not claim a slug that is already owned by an org; show “taken” and require a different username.
- **Org create / org slug edit** must not claim a slug that is already owned by a profile; show “taken” and require a different slug.

---

## 4. Migration / Transfer Policy

### 4.1 Policy (strict)

- **Transfer of a slug from profile to org, or from org to profile, is allowed only through a manual admin migration process.**
- Normal product flows (onboarding, login, profile edit, org create, org slug update) **must not** perform a transfer. They may only:
  - Claim a slug that is **free** in usernames, or
  - Re-claim or update for the **same** owner (same profile or same org).

### 4.2 When transfer is needed

- One-off remediation (e.g. resolving a historical collision like `desicryptoclub`) or a deliberate product decision to move a slug from one entity type to the other.

### 4.3 Requirements for transfer

- **Manual / admin-safe:** Not triggered by end-user login or onboarding. Executed by an admin or a one-off script/migration with explicit approval.
- **Audit trail:** Log or record: slug, previous owner_type and owner_id, new owner_type and owner_id, timestamp, and who/what performed the transfer.
- **Atomic and consistent:** Update `usernames` (and denormalized `profiles.username` or `orgs.slug`) in a single transaction so that the slug is never left with two owners or none.
- **No silent takeover:** The losing entity must be updated to a different slug or placeholder (e.g. profile gets a new username, org gets a new slug) as part of the same process so that both entities remain valid.

### 4.4 Implementation options

- **Option 1:** No RPC for transfer; transfers are done via one-off SQL or admin scripts, with a checklist (update usernames, update profile or org, log).
- **Option 2:** A dedicated admin-only RPC or API, e.g. `transfer_slug_ownership(slug, from_owner_type, from_owner_id, to_owner_type, to_owner_id)`, guarded by role/superuser, with logging. Normal claim RPCs never call it.

---

## 5. Examples Using `desicryptoclub`

### 5.1 Scenario: Slug is owned by profile

- **usernames:** `(username = 'desicryptoclub', owner_type = 'profile', owner_id = '<profile_id>')`
- **Public:** `linkary.xyz/desicryptoclub` → public **user** profile. Canonical, indexable.
- **In-app user:** `linkary.xyz/u/desicryptoclub` → in-app profile (auth, analytics). Valid.
- **In-app org:** `linkary.xyz/org/desicryptoclub` → must **not** resolve to a profile. **302 redirect** to `linkary.xyz/desicryptoclub` (public profile).
- **Org create / org slug edit:** If someone tries to create an org or set org slug to `desicryptoclub`, the claim **fails** (slug taken by profile). No transfer.

### 5.2 Scenario: Slug is owned by org

- **usernames:** `(username = 'desicryptoclub', owner_type = 'org', owner_id = '<org_id>')`
- **Public:** `linkary.xyz/desicryptoclub` → public **org** profile. Canonical, indexable.
- **In-app org:** `linkary.xyz/org/desicryptoclub` → in-app org (auth, analytics). Valid.
- **In-app user:** `linkary.xyz/u/desicryptoclub` → must **not** resolve to the org. **302 redirect** to `linkary.xyz/desicryptoclub` (public org).
- **Profile onboarding / profile edit:** If a user tries to claim username `desicryptoclub`, the claim **fails** (slug taken by org). No transfer.

### 5.3 Transfer example (admin only)

- **Before:** `desicryptoclub` owned by profile (e.g. after Option A remediation).
- **Decision:** Product decides the brand should be the org; admin runs transfer.
- **Steps:** (1) Update profile to a new username (e.g. `profile-desicrypto`); (2) Remove or update profile’s usernames row for `desicryptoclub`; (3) Insert/update usernames so org owns `desicryptoclub`; (4) Ensure `orgs.slug = desicryptoclub`; (5) Log transfer. After that, `/:desicryptoclub` and `/org/desicryptoclub` resolve to the org; `/u/desicryptoclub` no longer valid for that slug (redirect or 404).

---

## 6. Routing Consequences

- **Public `/:segment`:** Always one entity (profile or org) from usernames. No session-based override. Canonical URL and sitemap entries use this resolution.
- **`/u/:username`:** Only profile-owned slugs. If slug is org-owned, do not show profile; **302 redirect** to `/:segment` (public org).
- **`/org/:slug`:** Only org-owned slugs. If slug is profile-owned, do not show org; **302 redirect** to `/:segment` (public profile).
- **Search and links:** Public discovery uses `/:username` (profiles) and `/:slug` (orgs). In-app links use `/u/:username` for people and `/org/:slug` for orgs. Link generation must use the same usernames-based resolution so that the correct URL is used for the entity type that owns the slug.

---

## 7. Claim / Update Consequences

- **Profile username claim (any entry point):** Check usernames. If slug exists with `owner_type = 'org'` → fail with “taken” (or equivalent). Do not overwrite org ownership.
- **Org slug claim (create or update):** Check usernames. If slug exists with `owner_type = 'profile'` → fail with “taken”. Do not overwrite profile ownership.
- **Same-entity update:** Profile changing to another username releases the old slug (usernames row updated or removed) and claims the new one. Org changing slug same: release old, claim new. No cross-type takeover.

---

## 8. Implementation Implications

### 8.1 Database (usernames)

- **Single source of truth:** Every claimed slug has exactly one row in `usernames` with `(username, owner_type, owner_id)`. Unique on `username` (normalized).
- **Enforce at write:** `claim_username_for_profile` and org claim path (e.g. `claim_username_for_org` or logic inside `create_org_and_membership`) must **reject** if the slug is already owned by the **other** owner_type. No “takeover” branch for the other type in normal claim flows.
- **Denormalization:** `profiles.username` and `orgs.slug` stay in sync with usernames for the owning entity only. On transfer, both usernames and the relevant profile/org row are updated in one process.

### 8.2 API

- **Profile claim APIs** (onboarding, X sync, profile edit): Call claim RPC; return 400 with clear code (e.g. `USERNAME_TAKEN_BY_ORG`) when slug is owned by an org.
- **Org create / org slug update APIs:** Check usernames before creating or updating; return 400 when slug is owned by a profile (e.g. `SLUG_TAKEN_BY_PROFILE`). Use `claim_username_for_org` or equivalent so that successful org claim inserts/updates usernames with `owner_type = 'org'`.
- **Slug availability endpoint:** Global check: slug is available only if it is not in usernames (or is in usernames for the **same** entity making the request). Return “taken” when owned by the other type.

### 8.3 Resolver (public and in-app)

- **Public `/:segment`:** Resolve from usernames only: `SELECT owner_type, owner_id FROM usernames WHERE username = normalized(segment)`. Then load profile or org by owner_id. No profile-first/org-second fallback that could flip by session.
- **`/u/:username`:** Resolve username to profile. If usernames says owner_type = 'org', do not serve profile page; **302 redirect** to `/:segment` (public org).
- **`/org/:slug`:** Resolve slug to org. If usernames says owner_type = 'profile', do not serve org page; **302 redirect** to `/:segment` (public profile).

### 8.4 UI

- **Profile onboarding / username field:** Show “This username is taken” (or “taken by an organization”) when availability check returns taken by org. Do not allow submit.
- **Org create / org slug field:** Show “This slug is taken” (or “taken by a user”) when availability check returns taken by profile. Do not allow submit.
- **No transfer in UI:** No end-user button to “transfer my username to an org” or “take this profile’s username for my org” in normal flows. Transfer is admin-only and documented.

---

## 9. Summary

| Principle | Rule |
|-----------|------|
| **Ownership** | One slug → one owner_type (profile or org) and one owner_id in usernames. |
| **Resolver** | `/:segment` from usernames only. `/u/:username` for profiles only. `/org/:slug` for orgs only. |
| **Claim** | Profile claim fails if slug is org-owned. Org claim fails if slug is profile-owned. No silent takeover. |
| **Transfer** | Allowed only via manual admin migration with audit trail. Never during login or onboarding. |
| **Strict policy** | Slug claimed as org → stays org. Slug claimed as profile → stays profile. |

This document should be read together with `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md` for full URL and namespace design, and with `LINKARY_NAMESPACE_REMEDIATION_AND_BACKFILL_PLAN.md` for one-time collision resolution and backfill.

---

*End of document.*
