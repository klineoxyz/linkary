# Production smoke tests

Minimal steps and SQL to verify core flows without guessing. Run these after deploy to confirm org creation, routing, and X connection.

---

## 1. Org creation (end-to-end)

**Steps**

1. Log in (e.g. via Coinbase CDP / X).
2. Go to **My Dashboard**.
3. Click **Create org** (or equivalent); fill name, optional slug, type; submit.
4. Expect: modal closes, you are on **Org detail** for the new org; org appears in your dashboard list.

**Verify in DB**

- New row in `public.orgs` (id, slug, name, owner_profile_id = your user id, published = false, is_x_verified = false).
- New row in `public.org_members` (org_id = new org, user_id = your user id, role = 'owner').

**API check (optional)**

```bash
curl -X POST "https://<your-app>/api/orgs/create" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Org","org_type":"brand"}'
```

Expect `{ "ok": true, "orgId": "<uuid>", "slug": "smoke-org" }` or a clear error (e.g. 401, 400 with message).

---

## 2. SQL: Recent orgs

```sql
SELECT id, slug, name, owner_profile_id, published, is_x_verified, created_at
FROM public.orgs
ORDER BY created_at DESC
LIMIT 20;
```

Use to confirm orgs exist and who owns them.

---

## 3. SQL: Recent org_members (owner rows)

```sql
SELECT om.id, om.org_id, om.user_id, om.role, o.slug, o.name AS org_name
FROM public.org_members om
JOIN public.orgs o ON o.id = om.org_id
WHERE om.role = 'owner'
ORDER BY om.id DESC
LIMIT 20;
```

Use to confirm every created org has an owner membership.

---

## 4. SQL: Published + verified orgs (public view)

```sql
SELECT id, slug, name, published, is_x_verified
FROM public.public_org_view
WHERE published = true AND is_x_verified = true
ORDER BY updated_at DESC
LIMIT 20;
```

Use to confirm only X-verified orgs appear as published and in public search.

---

## 5. SQL: X-connected profiles count

```sql
-- By profile flag (legacy)
SELECT COUNT(*) AS x_connected_count FROM public.profiles WHERE x_connected = true;

-- By social_accounts (preferred)
SELECT COUNT(*) AS social_x_active
FROM public.social_accounts
WHERE provider = 'x' AND revoked_at IS NULL AND status = 'connected';
```

Use to confirm X connection persistence (Integrations “Connected” state).

---

## 6. Connect org X → is_x_verified = true

**Steps**

1. As org owner, open org detail.
2. Use **Connect X** (org X OAuth flow); complete flow.
3. Expect: org shows as X connected; `is_x_verified` can be set to true (depends on your org connect flow).

**Verify**

```sql
SELECT id, slug, name, is_x_verified, x_account_username
FROM public.orgs
WHERE id = '<org_id>';
```

---

## 7. Publish org → published = true

**Steps**

1. With org X connected (`is_x_verified = true`), use **Publish** (or equivalent).
2. Expect: org appears in public listing and in `/api/search` (if you use it).

**Verify**

- Same query as section 4; org should appear in `public_org_view` where `published = true`.
- Optional: call your public search API and confirm the org is returned.

---

## 8. X connection for profile persists

**Steps**

1. Connect X in **Settings → Integrations** (profile X).
2. Log out, log back in (e.g. CDP X).
3. Open **Integrations** again.
4. Expect: still shows **Connected** with handle (from `social_accounts` / DB, not from CDP identities).

**Verify**

- Section 5 SQL: count of active X connections.
- No reliance on `auth.users.identities` for “Connected” in UI.

---

## Quick reference: four core SQL snippets

| Purpose | Snippet |
|--------|--------|
| **Recent orgs** | `SELECT id, slug, name, owner_profile_id, published, is_x_verified, created_at FROM public.orgs ORDER BY created_at DESC LIMIT 20;` |
| **Recent org_members (owners)** | `SELECT om.org_id, om.user_id, om.role, o.slug FROM public.org_members om JOIN public.orgs o ON o.id = om.org_id WHERE om.role = 'owner' ORDER BY om.id DESC LIMIT 20;` |
| **Published + verified (public view)** | `SELECT id, slug, name, published, is_x_verified FROM public.public_org_view WHERE published = true AND is_x_verified = true LIMIT 20;` |
| **Connected profiles (X)** | `SELECT COUNT(*) FROM public.social_accounts WHERE provider = 'x' AND revoked_at IS NULL AND status = 'connected';` |

---

## Route lockdown check

- Direct visit or link to a **non-production** route (e.g. `/explore`, `/calendar`, `/circles`, `/showcase`) should redirect to **Overview**.
- Only the routes in `docs/PRODUCTION_ROUTES_FINAL.md` (final list) should render real content; all others redirect to Overview.
