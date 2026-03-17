# CRM: QA checklist — individual task board (post bootstrap fix)

Use this after deploying the bootstrap observability and first-success UI to verify that a real individual user can reach the task board and that org/campaign flows are unchanged.

---

## Prerequisites

- Real individual user account (or test account with `profile_type = 'individual'`, `published = false`).
- For cross-subdomain: `NEXT_PUBLIC_COOKIE_DOMAIN=.linkary.xyz` set for both apps if using crm.linkary.xyz and linkary.xyz.

---

## 1. Login and session

- [ ] User can sign in on CRM (crm.linkary.xyz or local).
- [ ] After login, session is present (no immediate redirect back to login).
- [ ] If using both linkary.xyz and crm.linkary.xyz, session is shared when cookie domain is set (user stays logged in on both).

---

## 2. /tasks no longer hits workspace creation failure (individual)

- [ ] Individual user opens **Tasks** (or home → "Create my task board" → /tasks).
- [ ] User does **not** see "We couldn't create your task board" / "Could not create your workspace" when profile exists and RLS/cookie are correct.
- [ ] If they do see the failure: add `?debug=1` to URL and note `reason` and `stage`; check server logs for `[CRM bootstrap] failed: ...`; use **docs/CRM_BOOTSTRAP_ROOT_CAUSE_AND_DEBUG.md** to fix (profile, cookie domain, RLS).

---

## 3. Creator board loads (success path)

- [ ] After opening /tasks, the **Tasks** page loads with header "Tasks", filters, and task list (or empty state).
- [ ] No redirect to home and no "We couldn't create your task board" when bootstrap succeeds.

---

## 4. Empty state and welcome when no tasks

- [ ] **Workspace hero** at top: "Your workspace" with one-line description and "New task" button.
- [ ] **First-run block:** "Setup complete" and "This is your personal workspace" with short explanation and primary CTA.
- [ ] **Empty list:** "Your board is ready" (or "No tasks match this filter" when filtered) with icon and CTA.
- [ ] CTA opens create-task flow; optional hint about campaign tasks showing up when in a campaign.

---

## 5. First manual task

- [ ] User can click the create-task CTA and submit a new task (title, optional fields).
- [ ] Task appears in the list with "Manual" badge (or equivalent).
- [ ] Task can be opened and edited; no regression in task detail/update flow.

---

## 6. Manual vs campaign

- [ ] **Type column:** Personal (file icon) vs Campaign (megaphone icon) badges; campaign rows have subtle tint.
- [ ] Summary line when tasks exist: "X personal · Y campaign" (or single type).
- [ ] Filters (All, This week, Campaign, etc.) work as before.

---

## 7. No regression: campaigns / org / reporting

- [ ] User with **org workspace only** can open **Campaigns** and sees campaigns list or "No org workspace access" empty state (no redirect to home with task board CTA).
- [ ] User with **both** creator and org can use Home → choose Tasks or Campaigns; both flows work.
- [ ] Campaign list, campaign detail, reporting, and submissions behave as before (no unintended changes).

---

## 8. Failure observability (when bootstrap fails)

- [ ] If workspace/board creation fails, the failure screen shows the user-facing message and "Try again" / sign out hint.
- [ ] With `?debug=1`, the failure screen shows a debug line: `reason=... stage=...` (no PII).
- [ ] Server logs show `[CRM bootstrap] failed: reason=... stage=...` with no PII.

---

## Sign-off

- [ ] All items above checked for at least one real individual user.
- [ ] Any remaining known limitations (e.g. cookie domain, extra NOT NULL on `profiles`) documented and tracked.
