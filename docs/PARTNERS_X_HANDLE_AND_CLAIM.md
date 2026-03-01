# Partners: Search by X Handle + Project Claim & Accept

## Current behavior

- **Partner programs** (Affiliates / Ambassadors) are **manual entries**: name, website URL, logo, description, since date, featured.
- Stored in `partner_programs` with `owner_type`, `owner_id`, `program_type`, `name`, `website_url`, `logo_*`, etc. **No link to another profile or X handle.**
- No search when adding; user types name and website by hand.

## Desired behavior (your description)

1. **Search by project’s X handle**  
   When adding an affiliate/ambassador, the user can **search by the project’s X (Twitter) handle**. That can resolve to an existing Linkary profile (or later to an auto-created one).

2. **Auto-create Project profile**  
   If the project doesn’t exist on Linkary yet, the system can **create a Project profile** (e.g. keyed by X handle) so there is a page to claim later.

3. **Claim page when project signs up**  
   When the project **signs up for Linkary** and connects their X account, they can **claim** the page (e.g. linkary.xyz/username or a reserved slug).

4. **Accept affiliates/ambassadors**  
   The project can see who added them as affiliate/ambassador and **accept** those links (so the relation becomes two-sided or “active”).

## What already exists

- **Profile search**  
  `GET /api/search/profiles?q=...` already searches `public_profile_view` by `username`, `display_name`, and **`twitter_username`** (`.ilike`). So “search by X handle” can use this for **existing** profiles.

- **Profiles**  
  Profiles have `twitter_username`, `profile_type` (e.g. individual, project, company). No “stub” or “unclaimed” profile flow in code yet.

- **Partner programs**  
  No `target_profile_id` (or similar) on `partner_programs`; no link from a partner row to a Linkary profile.

## Suggested implementation order

### Phase 1 – Search by X handle and link to existing profile (minimal, no schema break)

- **Optional schema**: Add `target_profile_id` (nullable) to `partner_programs` so a row can point to a Linkary profile.
- **Partner modal (Add/Edit)**  
  - Add a “Search project by name or X handle” field that calls `GET /api/search/profiles?q=...`.  
  - User selects a profile → prefill name (and optionally website) from that profile and set `target_profile_id` when saving.  
  - Keep existing manual name/website/logo flow; when a profile is selected, show that profile’s card and allow saving as “affiliate/ambassador of **this** project”.
- **No auto-create yet.** If no profile is found for the X handle, user continues to add a manual partner (name + website) as today.

### Phase 2 – Stub Project profiles by X handle

- When adding an affiliate/ambassador by X handle and **no** profile exists:  
  - Call a new API (e.g. “find-or-create profile by X handle”) that creates a **minimal Project profile** (e.g. `twitter_username`, `profile_type: project`, `published: false` or “unclaimed” state).  
- That creates a claimable page (e.g. by username derived from X handle or a reserved slug).

### Phase 3 – Claim flow

- When a user signs up (or connects X):  
  - Match by `twitter_username` to existing profiles that are “unclaimed” or “stub”.  
  - Allow them to **claim** that profile (e.g. take over the page, set password, etc.).

### Phase 4 – Accept flow

- As the **project** (claimed profile):  
  - New section or inbox: “Pending affiliates/ambassadors” (partner_programs where `target_profile_id = me.id` and perhaps a new `status` like `pending_accept`).  
  - Project can **accept** (e.g. set `status: accepted` or create a reverse relation).  
  - Accepted partners show on the project’s public page under “Partners & programs” (or equivalent).

## What to do next

- If you want **only Phase 1** (search by X handle + link to existing profile), we can:
  1. Add nullable `target_profile_id` to `partner_programs` (migration).
  2. Extend Partner GET/POST/PATCH to read/write `target_profile_id`.
  3. In the Partner modal, add search-by-name-or-X-handle using `/api/search/profiles`, and when a profile is selected, pass `target_profile_id` and prefill name/website from that profile.

- If you want to **skip schema for now** and only add “search by X handle” in the UI that **prefills** name/website when user picks a profile (without storing `target_profile_id`), we can do that with no DB change; the partner row stays manual but the UX is better.

Tell me which you prefer: **Phase 1 with schema**, **prefill-only (no schema)**, or **full plan (Phases 2–4)** and I’ll outline or implement the concrete steps.

---

## Phase 1 polish & sanity checks (done)

- **Sign route rate limit:** Uses `rateLimit()` from `@/lib/rate-limit`, which calls Postgres `consume_rate_limit` RPC. The sign route passes **service role** Supabase (`createClient(supabaseUrl, supabaseServiceKey)`) as `supabaseAdmin`, so the RPC runs with sufficient privileges. Same pattern as partners GET/POST.
- **Search profiles `website`:** Search hits `public_profile_view`, which only includes **published** profiles. The view already exposes `p.website`; returning it in search is safe because it’s only for profiles that are already public.
- **Partner display:** When `target_profile_id` is set, the list shows a “Linked” badge; when the API returns `target_profile_username` (from profiles join), the partner name is a link to that profile’s public page.
- **Search UX:** Input is normalized before calling the API: strip leading `@`, trim, and extract handle from `https://x.com/...` or `https://twitter.com/...` URLs.
- **API:** `targetProfileId` empty string or whitespace-only is treated as `null` in POST and PATCH.
- **Data stability:** Prefill (name/website) happens only on first profile select; manual edits are kept and not overwritten.
