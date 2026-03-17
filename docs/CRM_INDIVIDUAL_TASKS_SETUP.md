# CRM: Why an individual might not see or add tasks

This doc explains the requirements for the **Tasks** (personal task board) flow and what to change if an individual user cannot see or add tasks.

---

## How it works

1. **Home (/)**  
   - If you have no CRM workspace, you see **"No workspace yet"** and a button **"Set up my task board"** that links to `/tasks`.

2. **Tasks (/tasks)**  
   - The app checks:
     - Do you have a row in **`profiles`** with `id = your auth user id`?
     - Is **`profile_type`** = **`'individual'`**? (Only `individual` can get a personal task board.)
   - If there is **no profile**: you see *"Your account isn't set up for Tasks yet. Sign in on linkary.xyz first, then open Tasks again."*
   - If the profile exists but **profile_type** is not `individual` (e.g. `project` or `company`): you see *"You don't have access to a personal task board"* and are directed to Campaigns or home.
   - If you **are** eligible: the app creates a **creator workspace** and **personal board** (if they don’t exist). If that creation fails, you see **"Could not create your workspace. Try signing out and back in."**

So to **see and add tasks** as an individual you need:

- A **`profiles`** row with `id` = your auth user id and **`profile_type = 'individual'`**.
- The **creator workspace + board** to be created successfully (RLS and DB must allow it).

---

## What to do

### 1. Ensure you have a profile (and that it’s `individual`)

- **If you use the main Linkary app (e.g. linkary.xyz):**  
  Sign in there first. The main app’s post-login bootstrap creates a profile with default `profile_type = 'individual'`. Then open the CRM and use **"Set up my task board"** again.

- **If you only use the CRM:**  
  The CRM tries to create a minimal profile (`id`, `profile_type = 'individual'`) when you open Tasks and no profile exists. If that insert fails (e.g. your `profiles` table has other required columns), use the main app sign-in or the manual SQL below.

### 2. Manual fix in the database (for one-off or testing)

If you have access to Supabase (e.g. SQL Editor), you can ensure a profile exists and is `individual`:

```sql
-- Replace <your-auth-uuid> with your auth user id (from Supabase Auth > Users or your app).
INSERT INTO public.profiles (id, profile_type)
VALUES ('<your-auth-uuid>', 'individual')
ON CONFLICT (id) DO UPDATE SET profile_type = 'individual';
```

(If `profiles` has a NOT NULL column without default, add it to the INSERT. The important part is `id` and `profile_type = 'individual'`.)

### 3. If you still see "Could not create your workspace"

That means **workspace** or **board** creation failed (e.g. RLS or duplicate slug). Check:

- **Supabase logs** (Database or API) for the failing INSERT (e.g. `crm_workspaces`, `crm_workspace_members`, `crm_boards`).
- That **`crm_current_profile_id()`** returns your user id (it does `SELECT id FROM profiles WHERE id = auth.uid()`). If there is no profile for `auth.uid()`, it returns NULL and RLS blocks the insert.

---

## Summary

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| "No workspace yet" on home | No creator and no org workspace | Go to **Set up my task board** → /tasks. If you have no profile, sign in on linkary.xyz first or use the CRM’s profile bootstrap (if added). |
| "Your account isn't set up for Tasks yet" | No `profiles` row for your user | Sign in on linkary.xyz so the main app creates the profile, or use manual SQL above, or rely on CRM profile bootstrap if implemented. |
| "You don't have access to a personal task board" | `profile_type` is not `individual` | Change `profile_type` to `individual` in DB (see manual fix) or use an account that is meant to be an individual creator. |
| "Could not create your workspace" | Profile exists but workspace/board insert failed | Ensure profile exists for `auth.uid()`; check Supabase logs and RLS. |

No code changes are required for **Campaigns** or **reporting**; this only affects the **Tasks** (personal task board) flow for individuals.

---

## Backend vs UI vs remaining (individual task experience)

**Backend / access logic only (no visible UI change):**
- Profile bootstrap: when no profile exists, CRM tries to insert `profiles(id, profile_type, published)` so workspace creation can run; `createTaskAction` uses `getOrCreateCreatorWorkspaceAndBoard` so adding a task also resolves workspace/board.
- RLS and workspace/board creation logic are unchanged; only the minimal profile insert and the way we render failure states changed.

**Actual visible UI changes:**
- **Home (no workspace yet):** Headline is now “Get your personal task board”; one short line of copy; primary CTA “Create my task board”; smaller note about individual vs org.
- **Tasks — no profile:** Dedicated “Set up your account for Tasks” card with icon, message, hint, and “Back to home” link.
- **Tasks — wrong profile type:** Dedicated “Personal task board isn’t available” card with icon, short explanation, and “Go to Campaigns” / “Home” CTAs.
- **Tasks — workspace creation failed:** Dedicated “We couldn’t create your task board” card with icon, message, “Try again” (link to `/tasks`) and note to sign out/in; support note at bottom.

**What still remains for a better individual creator task experience:**
- Optional: progress or step indicator on home (“Step 1: Create your board”) and a brief “You’re all set” moment on first load of /tasks after bootstrap.
- Optional: empty state on the task list (e.g. “No tasks yet — add your first task”) with a prominent “New task” CTA.
- If `profiles` has more NOT NULL columns in your deployment, the minimal profile insert may still fail; then the “Set up your account for Tasks” state is shown and the doc above applies.
