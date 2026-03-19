# Beta support troubleshooting

Short practical guide for support during invited beta.

---

## “Accepted work but no CRM task yet”

**What the user sees:** They were accepted on Linkary for a gig/sprint but don’t see a task in CRM (crm.linkary.xyz/tasks).

**Checks (in order):**

1. **Same account** — User must use the same email/login on CRM as on Linkary. If they logged in with a different provider or email on CRM, they won’t see the task.
2. **Refresh / re-open** — Ask them to refresh the Tasks page or close and reopen crm.linkary.xyz/tasks. Sync runs at accept time; sometimes the first load is cached.
3. **Creator workspace** — If they see “Could not create your workspace” or an error on /tasks, their personal (creator) workspace may have failed to create. This can be due to:
   - Missing or incorrect Supabase env on CRM (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
   - RLS: ensure migration `20260421000000_crm_workspaces_owner_select_rls_fix.sql` is applied so creator workspace creation can complete.
4. **Sync not configured** — If Linkary is not configured to call CRM (missing CRM_APP_URL or CRM_SYNC_SECRET on the **web** app), tasks are never created in CRM. Check web app env; sync runs when an org owner/admin accepts an application.
5. **CRM sync secret mismatch** — Web app’s CRM_SYNC_SECRET must equal CRM app’s CRM_SYNC_SECRET. If they differ, sync requests are rejected with 401.

**What to tell the user:** “Make sure you’re logged into CRM with the same account as Linkary. Refresh the Tasks page. If you still don’t see it, we’ll check that the sync ran (we’ll look into it).”

---

## “Why can’t I see campaigns?”

**What the user sees:** They expect to see Campaigns in CRM but see “No org workspace in CRM” or an empty list.

**Checks:**

1. **Who runs campaigns** — Campaigns in CRM are for **org** workspaces. Only users who are **owner or admin** of a Linkary org see org campaigns. Personal work shows under **Tasks**, not Campaigns.
2. **Org workspace bootstrap** — On first visit to crm.linkary.xyz/campaigns, the app tries to create a CRM workspace for each Linkary org they admin. If that fails (e.g. RLS or missing profile), they stay with “No org workspace in CRM.” Ask: “Are you an owner or admin of an org on Linkary?”
3. **Same account** — They must be logged into CRM with the same account that has org membership on Linkary.
4. **Empty list** — If they do have an org workspace but the list is empty, that’s expected until at least one campaign exists (e.g. after someone is accepted to a sprint and sync runs). Campaigns appear when accepted work is synced from Linkary.

**What to tell the user:** “Campaigns are for orgs you run on Linkary. Use Tasks for your personal deliverables. If you’re an org admin and still see no campaigns, make sure you’re logged in with the same account and try refreshing; we can also check that your org has a linked workspace.”

---

## “Org not found” on /org/[slug]

**If they see the default Next.js “404 | This page could not be found”** (not the in-app “Org not found.” line), the server could not resolve the org. Apply migration `20260424000000_resolve_org_public_by_segment.sql` and redeploy web so SSR uses `resolve_org_public_by_segment` (bypasses RLS drift on `orgs` / `usernames` reads).

**Checks:**

1. **Correct URL** — Confirm they’re using the org’s slug (e.g. `/org/desicryptoclub`) or the org’s UUID. Mixed case is supported; encoding is handled.
2. **Org exists and is reachable** — The org must exist in the database. If it was just created, a hard refresh can help. Unpublished orgs are still resolvable for members; public visibility depends on product rules.
3. **404 from server** — If the server can’t resolve the slug (not in orgs.slug and not in usernames), the app returns 404. No client-side “Org not found” should appear for a valid slug if migrations and server resolution are in place.

**What to tell the user:** “Try the exact org slug from the org’s URL on Linkary. If it still says not found, we’ll verify the org exists and the link.”

---

## Known limitations for beta

- **Promoted org on job** — When creating a sprint, “Promoted org ID” is a manual UUID field; there’s no dropdown of orgs. Users can leave it blank or paste an org ID from another source.
- **Campaign definition in CRM** — Objective and guidance links are set from Linkary when work is accepted. They can’t be edited in CRM’s “Edit definition” form (only other fields can be edited there).
- **Recurring tasks** — Weekly posting expectations are stored and shown to creators and reviewers, but the system does not auto-generate recurring tasks from cadence; tasks come from the single sync at accept time.
- **Cookie domain** — For shared login between linkary.xyz and crm.linkary.xyz, both apps must set `NEXT_PUBLIC_COOKIE_DOMAIN=.linkary.xyz` in production. If not set, users may need to log in separately on each domain.
