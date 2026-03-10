# Linkary: Namespace Remediation and Backfill Plan

**Purpose:** Precise, production-safe plan to resolve the `desicryptoclub` collision and backfill org slugs into `usernames` so the global namespace is clean before any route or resolver migration.  
**Scope:** Data remediation and one-time backfill only. No route changes, no resolver changes, no `/app/...` changes.  
**References:** `LINKARY_NAMESPACE_AUDIT_REPORT.md`, `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md`.

---

## 1. Exact Collision Details

| Field | Value |
|-------|--------|
| **Slug** | `desicryptoclub` |
| **Profile ID** | `ce3dbb39-5ff3-4712-bbd1-19cbd32583ed` |
| **Org ID** | `520af360-4196-4a41-94d3-523b0ae6c4cc` |

- The profile has `desicryptoclub` as either `profiles.username` or `profiles.twitter_username` (or both), normalized to `desicryptoclub`.
- The org has `orgs.slug = desicryptoclub`.
- Current resolver (`getPublicEntityByUsername`): profile first, then org → `linkary.xyz/desicryptoclub` resolves to the **profile**.
- **Ownership is not assumed.** A product decision is required: either the profile or the org keeps the slug; the other must be updated.

---

## 2. Orgs Missing from usernames (Backfill Targets)

| Org slug (normalized) | Org ID |
|------------------------|--------|
| `desi-crypto-club` | `a74ed16b-cf06-4ccf-bf6d-7dad536e28cf` |
| `desicrypto-club` | `ea3d34eb-123e-4096-ac2f-04d1db9ea2c2` |
| `desicryptoclub` | `520af360-4196-4a41-94d3-523b0ae6c4cc` |

After collision resolution, the slug that **no longer** belongs to the losing entity will be that entity’s new identifier. The backfill script only inserts into `usernames` for org slugs that are **currently** on each org at run time; it will skip any slug that is already taken in `usernames` by another owner (so the “losing” side must have already been updated before backfill).

---

## 3. Recommended Resolution Options (No Ownership Guess)

Two mutually exclusive options. **Choose one** before making any changes.

---

### Option A: Profile Keeps `desicryptoclub`

**Outcome:** The profile remains the canonical owner of `desicryptoclub` in the global namespace. The org must use a different slug.

#### 3.A.1 DB and app changes (exact order)

1. **Change the org’s slug** (so it no longer uses `desicryptoclub`).
   - **Option A1 (preferred – app path):** In the app, org settings: update the org’s slug to a new value (e.g. `desicryptoclub-org`, `desicrypto-club-official`, or another agreed slug).  
     - **App:** Org detail/settings → slug field → save. This calls `updateOrg(orgId, { slug: newSlug })` in `@/lib/orgs.ts`, which does `UPDATE orgs SET slug = ?, updated_at = now() WHERE id = ?`.  
     - **Caveat:** `updateOrg` does **not** write to `usernames`. So after this step, `orgs.slug` is updated but `usernames` still has no row for the org’s **new** slug. The backfill script will add that row.
   - **Option A2 (direct DB):** Run a one-off SQL update (e.g. in a migration or SQL console):
     ```sql
     UPDATE public.orgs
     SET slug = 'desicryptoclub-org', updated_at = now()
     WHERE id = '520af360-4196-4a41-94d3-523b0ae6c4cc';
     ```
     Replace `desicryptoclub-org` with the chosen slug. Same outcome: org no longer has slug `desicryptoclub`; backfill will add `usernames` for the new slug.

2. **Ensure the profile owns `desicryptoclub` in `usernames`.**
   - If the profile claimed the username via the app (onboarding, X sync, or profile edit), `usernames` should already have a row `(username = 'desicryptoclub', owner_type = 'profile', owner_id = profile_id)`.  
   - If **not** (e.g. profile has it only in `profiles.username` from an older flow), insert once:
     ```sql
     INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
     VALUES ('desicryptoclub', 'profile', 'ce3dbb39-5ff3-4712-bbd1-19cbd32583ed', NULL, NULL)
     ON CONFLICT (username) DO NOTHING;
     ```
     Only run if no row for `desicryptoclub` exists. If a row exists for another owner, do not run; resolve ownership first.

3. **Re-run audit:** `pnpm exec tsx apps/web/scripts/auditNamespaceCollisions.ts` → must report **0** profile/org collisions.

4. **Run backfill:** Execute the one-time backfill script (see Section 6). It will insert into `usernames` for every org whose slug is not yet present for that org; the org that used to have `desicryptoclub` now has a new slug, so the script will backfill the **new** slug only.

#### 3.A.2 URL and product impact

- **Public:** `linkary.xyz/desicryptoclub` continues to resolve to the **profile** (no change in current behavior).
- **Org:** In-app org URL today is `/org/520af360-4196-4a41-94d3-523b0ae6c4cc`. After route migration to `/org/:slug`, the org will be at `/org/<new-slug>` (e.g. `/org/desicryptoclub-org`). Any links or bookmarks that assume the org at `/:desicryptoclub` will not apply (profile stays there).

---

### Option B: Org Keeps `desicryptoclub`

**Outcome:** The org is the canonical owner of `desicryptoclub`. The profile must stop using that slug (username and/or twitter_username).

#### 3.B.1 DB and app changes (exact order)

1. **Change the profile’s username/handle** so the profile no longer uses `desicryptoclub`.
   - **Option B1 (preferred – app path):** Have the profile user sign in and set their username to a new value (e.g. add suffix or use another handle) via profile edit or onboarding. That flow calls `claim_username_for_profile(new_username)`, which updates `usernames` and `profiles.username`. If the current `profiles.username` or `profiles.twitter_username` is `desicryptoclub`, the new username must differ.  
   - **Option B2 (direct DB, use with care):**  
     - First, ensure no critical logic relies on the profile keeping `desicryptoclub`.  
     - Assign the profile a placeholder username and remove the slug from `usernames` so the org can claim it:
       ```sql
       -- Only if you have confirmed the profile should give up desicryptoclub.
       -- 1) Set profile to a new username (pick a valid slug, e.g. profile-<shortid>)
       UPDATE public.profiles
       SET username = 'profile-desicrypto', updated_at = now()
       WHERE id = 'ce3dbb39-5ff3-4712-bbd1-19cbd32583ed';

       -- 2) Remove profile’s claim on desicryptoclub from usernames (if present)
       DELETE FROM public.usernames
       WHERE username = 'desicryptoclub' AND owner_type = 'profile' AND owner_id = 'ce3dbb39-5ff3-4712-bbd1-19cbd32583ed';
       ```
     - Then the org can claim `desicryptoclub` via RPC (step 2 below). Prefer Option B1 where possible.

2. **Claim the slug for the org** so `usernames` has one row for `desicryptoclub` with `owner_type = 'org'`.
   - **Preferred:** Call existing RPC as an org owner/admin:
     ```sql
     SELECT public.claim_username_for_org('desicryptoclub', '520af360-4196-4a41-94d3-523b0ae6c4cc');
     ```
     Run as a user who is owner/admin of the org (e.g. in SQL as `auth.uid()` or via an API that runs with a service role and then calls the RPC with the right semantics). The RPC inserts into `usernames` and updates `orgs.slug` to match.  
   - **Alternative (service-role one-off):** If you cannot run as org member, insert directly (service role only):
     ```sql
     INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
     VALUES ('desicryptoclub', 'org', '520af360-4196-4a41-94d3-523b0ae6c4cc', NULL, NULL);
     ```
     Ensure `orgs.slug` is already `desicryptoclub` (it is today). If the profile was updated in step 1, no unique violation should occur.

3. **Re-run audit:** `pnpm exec tsx apps/web/scripts/auditNamespaceCollisions.ts` → must report **0** profile/org collisions.

4. **Run backfill:** Execute the one-time backfill script. It will add `usernames` rows for any other orgs still missing (e.g. `desi-crypto-club`, `desicrypto-club`). The org that keeps `desicryptoclub` may already have been given a row by step 2; the script is idempotent and will skip existing rows.

#### 3.B.2 URL and product impact

- **Public:** `linkary.xyz/desicryptoclub` will resolve to the **org** (after you switch the resolver to usernames-based or keep profile-then-org with profile no longer having that slug).
- **Profile:** Profile’s public URL becomes `linkary.xyz/<new-username>`. Update any external links or expectations.

---

## 4. Exact Order of Operations (Regardless of Option)

1. **Product decision:** Profile keeps `desicryptoclub` **or** org keeps it. Document the decision.
2. **Remediation:** Apply Option A or B (update one entity’s slug/username, ensure the other owns it in `usernames` as described).
3. **Audit:** Run `pnpm exec tsx apps/web/scripts/auditNamespaceCollisions.ts`. **Must exit 0 with 0 collisions.** If not, fix and repeat.
4. **Backfill:** Run the one-time backfill script so every org’s current slug has a row in `usernames` (see Section 6).
5. **Re-check (optional):** Run the audit script again; expect 0 collisions and 0 “orgs missing from usernames” (or a known, intentional gap).
6. **No route or resolver changes in this phase.** Route migration starts only after this is complete and verified.

---

## 5. Backfill Approach for Missing Org Usernames

### 5.1 Goal

Ensure every org with a non-empty `orgs.slug` has exactly one row in `usernames` with `username = normalized(org.slug)`, `owner_type = 'org'`, `owner_id = org.id`, without creating duplicates or overwriting existing owners.

### 5.2 Safety rules

- **Run only after collision resolution.** The script checks for profile/org collisions and exits with a non-zero code if any exist.
- **Idempotent:** For each org, if a row already exists in `usernames` for that slug and that org, skip. No updates.
- **No overwrites:** If the slug is already in `usernames` for a **different** owner (e.g. profile, or another org), do **not** insert for the org; log and skip. That slug is owned by someone else (e.g. after Option A or B).
- **Normalization:** Use the same normalization as the rest of the app: trim, lowercase, strip leading `@`. Match how `orgs.slug` is stored and how the audit script normalizes.
- **Service role:** Backfill needs to insert into `usernames`; use a Supabase client with service role key (e.g. in a one-off script or migration), not anon or end-user auth.

### 5.3 What the script does (high level)

1. Load env (Supabase URL + service role key); abort if missing.
2. **Collision check:** Build the same profile-slug and org-slug sets as the audit script. If any slug appears in both → exit 1, do not insert anything.
3. For each org with a non-empty normalized slug:
   - If `usernames` already has `(username = slug, owner_type = 'org', owner_id = org.id)` → skip.
   - Else if `usernames` has **any** row with `username = slug` (another owner) → log “slug already owned, skipping org”, skip.
   - Else → `INSERT INTO usernames (username, owner_type, owner_id, provider, verified_at) VALUES (slug, 'org', org.id, NULL, NULL)`.
4. Report: how many inserted, how many skipped (already present, or slug taken).

### 5.4 Rollback considerations

- **Backfill inserts only.** It does not delete or update existing rows. To “roll back” backfill, you would have to manually delete the rows that the script inserted. To make that possible:
  - Log each inserted `(username, owner_type, owner_id)` (e.g. to stdout or a small file) so you can remove them if needed.
  - Or run in a transaction and commit only after verification (script could support a dry-run that only logs what it would insert).
- **Remediation (Option A or B)** changes `profiles` or `orgs` and possibly `usernames`. Rollback is case-by-case:
  - **Option A rollback:** Restore org’s slug to `desicryptoclub` (and remove the profile’s usernames row if you had added it). Only if you have not yet run backfill and no other process depends on the new state.
  - **Option B rollback:** Restore profile’s username and usernames row for the profile, remove org’s usernames row for `desicryptoclub`. Same caveat.
  - Prefer taking a DB backup or snapshot before remediation if rollback might be needed.

---

## 6. One-Time Backfill Script (Safe to Run Only After Collision Resolution)

A script is provided that:

- **Refuses to run if any profile/org collision exists** (same logic as the audit script).
- Inserts into `usernames` only for orgs whose slug is missing for that org and not already taken by another owner.
- Is idempotent and logs what it did.

**Location:** `apps/web/scripts/backfillOrgUsernames.ts`  
**Run:** After remediation and a successful audit (0 collisions):

```bash
pnpm exec tsx apps/web/scripts/backfillOrgUsernames.ts
```

**Env:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`). Optional: `.env.local` in `apps/web` (script loads it).

**Do not run** before resolving the `desicryptoclub` collision; the script will exit with an error if it detects any collision.

---

## 7. What Must Be Completed Before Route Migration Starts

Before changing routes, resolver, or moving app pages under `/app/...`:

1. **Collision resolved:** Exactly one owner (profile or org) for the slug `desicryptoclub`; the other entity updated as in Option A or B.
2. **Audit clean:** `pnpm exec tsx apps/web/scripts/auditNamespaceCollisions.ts` exits **0** and reports **0** profile/org collisions.
3. **Backfill done:** One-time backfill script run successfully; every org with a slug has a corresponding row in `usernames` (or a known, intentional exception documented).
4. **(Later)** **Enforce writes:** `create_org_and_membership` and org slug updates use `usernames` (and reserved-path checks) so no new collisions can occur. This is a separate step after backfill; see `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md`.

Until 1–3 are done, **do not** move to usernames-based resolver, `/org/:slug` route migration, or `/app/...` route migration. The namespace must be clean and consistent first.

---

## 8. Summary

| Step | Action | Owner |
|------|--------|--------|
| 1 | Decide: profile keeps `desicryptoclub` (Option A) or org keeps it (Option B) | Product/Founder |
| 2 | Apply remediation (Option A or B); re-run audit until 0 collisions | Dev/Ops |
| 3 | Run `backfillOrgUsernames.ts`; verify no errors | Dev/Ops |
| 4 | Optionally re-run audit; confirm 0 collisions, 0 missing orgs (or documented) | Dev/Ops |
| 5 | Proceed to next phase (enforce org create/update to use usernames, then resolver, then routes) | After 1–4 |

**No risky writes in this plan except the chosen remediation (one entity’s slug/username change) and the backfill (insert-only, after collision is resolved).** Route migration remains blocked until the namespace is clean.

---

## 9. Founder Recommendation and Direct Execution Prompts

**Recommendation (consistency for branding and search):**

- If **desicryptoclub** is the **brand/project identity** → let the **org** keep it.
- If it is the **personal creator identity** → let the **profile** keep it.

Once you choose the owner, use one of the direct execution prompts below. The output is always `LINKARY_NAMESPACE_REMEDIATION_EXECUTION.md` with exact changes, audit results, backfill results, and final verdict.

---

### 9.1 If the org should keep `desicryptoclub` — use this prompt

```
Execute Option B from LINKARY_NAMESPACE_REMEDIATION_AND_BACKFILL_PLAN.md.

Decision:
The org keeps `desicryptoclub`.

Tasks:
1. Safely update the profile so it no longer uses `desicryptoclub`.
2. Ensure the org owns `desicryptoclub` in `usernames`.
3. Re-run the namespace audit and confirm 0 collisions.
4. Run the org usernames backfill script.
5. Re-run the audit again and confirm:
   - 0 collisions
   - no orgs missing from usernames, or clearly document any remaining intentional exceptions

Required output:
Create:
LINKARY_NAMESPACE_REMEDIATION_EXECUTION.md

Include:
- exact changes made
- profile old/new username
- usernames rows affected
- audit results before/after
- backfill results
- final verdict: namespace clean enough to proceed to route migration or not
```

---

### 9.2 If the profile should keep `desicryptoclub` — use this prompt

```
Execute Option A from LINKARY_NAMESPACE_REMEDIATION_AND_BACKFILL_PLAN.md.

Decision:
The profile keeps `desicryptoclub`.

Tasks:
1. Safely update the org so it no longer uses `desicryptoclub`.
2. Ensure the profile owns `desicryptoclub` in `usernames`.
3. Re-run the namespace audit and confirm 0 collisions.
4. Run the org usernames backfill script.
5. Re-run the audit again and confirm:
   - 0 collisions
   - no orgs missing from usernames, or clearly document any remaining intentional exceptions

Required output:
Create:
LINKARY_NAMESPACE_REMEDIATION_EXECUTION.md

Include:
- exact changes made
- org old/new slug
- usernames rows affected
- audit results before/after
- backfill results
- final verdict: namespace clean enough to proceed to route migration or not
```

---

### 9.3 What comes after remediation (only when namespace is clean)

Only after namespace is clean and `LINKARY_NAMESPACE_REMEDIATION_EXECUTION.md` has a “proceed” verdict, do this sequence:

1. **Enforce org create/update through usernames** — `create_org_and_membership` and org slug updates check and write `usernames`.
2. **Switch public resolver to usernames-based** — `/:segment` resolves from `usernames` only (one owner per slug).
3. **Add `/app/...` routes** — product pages under `/app/dashboard`, etc.
4. **Add `/org/:slug` in-app route** — in-app org by slug; optional 301 from `/org/:id`.
5. **Migrate internal links** — nav, notifications, emails to `/app/...` and `/org/:slug`.
6. **Add redirects** — old app paths → `/app/...`; canonical/sitemap/robots cleanup.

That order matches the architecture and keeps one clear canonical public surface with in-app/auth-only surfaces separate.

---

*End of document.*
