# QA & implementation pass: Org image, Invite search, Job/Sprint modal, apply_url

## 1. QA checklist (concise)

### 1) Org header image fallback
- [ ] Open Org Detail for an org that has **no** `logo_url` and **no** `x_account_username` → header shows Building2 placeholder.
- [ ] Same org: set **slug** to match an X handle (e.g. `desicryptoclub`) → header shows X avatar (unavatar.io/twitter/slug).
- [ ] Org with **logo_url** or **x_account_username** → header shows that image (logo first, then X by handle).

### 2) Affiliate invite search
- [ ] Org Detail → Affiliates tab → type 2+ chars in search → after ~300ms, dropdown lists Linkary users (people only).
- [ ] Select a user from dropdown → handle fills; click “Invite Affiliate” → invite sent; list shows new row (invited).
- [ ] Invitee (as that profile) sees Accept on the same row; Accept → status becomes active.
- [ ] Typing a handle that doesn’t exist and clicking Invite (no selection) → API resolves by handle (service-role lookup); either success or “Profile not found…”.

### 3) Ambassador invite search
- [ ] Same as (2) but in Ambassadors tab: search, select or type handle, Invite, invitee can Accept.

### 4) Job modal fields
- [ ] Org Detail → Jobs tab → “Create job” → type = **Job** → form shows: Title, Requirements and description (textarea), Apply URL (optional), Tags (optional).
- [ ] Submit with title + description + optional Apply URL → job created; GET /api/orgs/:id/jobs returns `description`, `apply_url`.

### 5) Sprint modal fields
- [ ] “Create job” → type = **Sprint** → form shows: Title, Duration, Total budget (e.g. USDT/Token), Objective of the campaign (textarea), Links for creators (one per line: Label URL or URL).
- [ ] Submit → job created with `duration`, `budget`, `objective`, `links` (array of `{ label?, url }`).

### 6) apply_url end-to-end
- [ ] Create a **Job** with an **Apply URL** (e.g. `https://example.com/apply`).
- [ ] Go to **Jobs & Sprints** (overview) in the app → find that job → click **Apply** → browser opens the Apply URL in a new tab (no in-app apply modal).
- [ ] If the apply modal is ever opened for a job that has `apply_url` (e.g. from another flow), modal shows “This job uses an external apply link” and **Open apply link** opens the URL.

---

## 2. apply_url status

- **Before this pass:** Schema + API + create modal only (stored and returned; no UI use).
- **After this pass:** **Launch-complete.**  
  - Jobs & Sprints list: **Apply** opens `apply_url` in a new tab when set.  
  - Apply modal: when the selected job has `apply_url`, modal shows “Open apply link” and does not submit in-app apply.

---

## 3. Files changed (this pass + prior for these features)

| File | Change |
|------|--------|
| `apps/web/src/figma/app/components/OrgDetailPage.tsx` | Org header slug fallback; affiliate/ambassador search state, effects, dropdowns; invite body with `profile_id`; create job modal (Job vs Sprint fields); job state (description, apply_url, objective, links). |
| `apps/web/src/app/api/orgs/[orgId]/affiliates/invite/route.ts` | Use service-role client for profile lookup by handle when available. |
| `apps/web/src/app/api/orgs/[orgId]/ambassadors/invite/route.ts` | Same. |
| `apps/web/src/app/api/orgs/[orgId]/jobs/route.ts` | POST/GET accept and return `description`, `apply_url`, `objective`, `links`. |
| `supabase/migrations/20260316000000_jobs_description_apply_url_objective_links.sql` | Add columns to `jobs`: `description`, `apply_url`, `objective`, `links`. |
| `apps/web/src/lib/jobs.ts` | `Job` type extended with `description`, `apply_url`, `objective`, `links`. |
| `apps/web/src/figma/app/App.tsx` | Jobs & Sprints: Apply button opens `apply_url` in new tab when set; apply modal shows external-link branch when `applyJob.apply_url` is set. |

---

## 4. Incomplete / non-blocking

- **Search API uses public view:** Affiliate/ambassador search uses `/api/search?filter=people`, which queries `public_profile_view`; users without a public profile may not appear. Acceptable for launch; optional later: dedicated “org invite search” endpoint with service-role so all registered users are findable.
- **Sprint “links” on public job card:** `links` are stored and returned by the API; the **public job/sprint card** (e.g. on a public org or discovery page) does not yet render “Links for creators” or a list of clickable links. Non-blocking for create/list/apply flow.
- **DB migration:** Run `npx supabase db push` (or apply `20260316000000_jobs_description_apply_url_objective_links.sql`) so new job columns exist before creating jobs with description/apply_url/objective/links.
