# CRM: Task board bootstrap — root cause and debug

This doc describes why an individual user might see **"We couldn't create your task board"** on `/tasks`, how to find the exact failure stage, and what to fix.

---

## Bootstrap chain (order of checks)

1. **Session** — Server has a valid Supabase session (cookie/JWT). If not → redirect to `/login`.
2. **Profile** — Row in `public.profiles` with `id = auth.uid()`. If missing, CRM tries to insert `(id, profile_type = 'individual', published = false)`. If insert fails → "Set up your account for Tasks".
3. **Profile type** — `profile_type = 'individual'`. If not → "Personal task board isn't available".
4. **Creator workspace** — Row in `crm_workspaces` with `owner_profile_id = profile id` and `type = 'creator'`. If missing, insert one (slug `creator-<first 8 of profile id>`).
5. **Workspace member** — Row in `crm_workspace_members` for that workspace and profile (role `owner`).
6. **Personal board** — Row in `crm_boards` with `workspace_id` and `kind = 'personal'`. If missing, insert one.

RLS uses `crm_current_profile_id()` which does `SELECT id FROM profiles WHERE id = auth.uid()`. So **auth.uid() must match the profile id** and **the profile row must exist** before any insert into `crm_workspaces` / `crm_workspace_members` / `crm_boards`.

---

## Likely root causes in production

| Symptom | Likely cause | What to check |
|--------|---------------|----------------|
| "We couldn't create your task board" | Workspace/board insert failed | Add `?debug=1` to URL; check server logs for `[CRM bootstrap] failed: reason=... stage=...`. |
| Same | **RLS** — `crm_current_profile_id()` returns NULL | No `profiles` row for `auth.uid()`. Ensure profile exists and insert runs before `getOrCreateCreatorWorkspaceAndBoard`. |
| Same | **RLS** — policy blocks insert | Ensure `profiles.id = auth.uid()` and profile row exists. Check Supabase logs for 42501 / policy errors. |
| Same | **Session not sent to server** (e.g. cookie domain) | User logs in on linkary.xyz but visits crm.linkary.xyz; cookie not sent. Set `NEXT_PUBLIC_COOKIE_DOMAIN=.linkary.xyz` for both apps so auth cookies are shared. |
| Same | **Duplicate slug (23505)** and race re-select fails | Code now retries after 150ms. If still failing, check for unique constraint on `crm_workspaces(slug)` and that RLS allows reading the row created by another request. |
| "Set up your account for Tasks" | Profile insert failed | Other NOT NULL columns on `profiles` not set; or RLS blocks insert (must be `auth.uid() = id`). |

---

## Failure reason codes (no PII in logs)

- `no_profile` — No row in `profiles` for this user (or select returned nothing).
- `wrong_profile_type` — Profile exists but not `individual` (handled on tasks page before bootstrap).
- `workspace_insert` — Insert into `crm_workspaces` failed (constraint, RLS, or other).
- `workspace_member_insert` — Insert into `crm_workspace_members` failed.
- `board_insert` — Insert into `crm_boards` failed.
- `rls_denied` — Insert failed with policy/42501-style error.
- `duplicate_slug_unresolved` — 23505 on workspace and re-select after delay still found no row.
- `session_missing` — No session (normally redirect to login).
- `unknown` — Fallback.

Server logs use: `[CRM bootstrap] failed: reason=<code> stage=<stage> detail=<code=...>`.

---

## Optional debug in the UI

- Add `?debug=1` to the URL (e.g. `/tasks?debug=1`). When bootstrap fails, the failure screen shows a small debug line: `reason=... stage=...`. Use this for support; no PII.

---

## Production checklist

1. **Cookie domain** — For crm.linkary.xyz to share auth with linkary.xyz, set `NEXT_PUBLIC_COOKIE_DOMAIN=.linkary.xyz` in both apps (and ensure cookies are set with that domain on login).
2. **Profile** — Ensure `profiles` has a row for the user. Manual fix: see `docs/CRM_INDIVIDUAL_TASKS_SETUP.md` (replace placeholder UUID with real Auth user UUID; include `published = false`).
3. **RLS** — No policy should block the creator workspace/board insert when `owner_profile_id = crm_current_profile_id()`. Verify `crm_current_profile_id()` returns the profile id (it does `SELECT id FROM profiles WHERE id = auth.uid()`).
4. **Schema** — No extra NOT NULL columns on `profiles` that the minimal insert doesn’t satisfy; otherwise profile insert fails and user sees "Set up your account for Tasks".

---

## What was changed in this pass

- **Observability:** Stable failure reason + stage in logs; optional `?debug=1` on the failure screen.
- **23505 handling:** Short delay (150ms) then re-select on duplicate slug so race with another request usually recovers.
- **RLS-style errors:** Mapped to `rls_denied` so logs and debug show that instead of generic insert error.
- **No PII** in logs or debug UI.
