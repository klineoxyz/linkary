# XSpaces Automation V1

What is automated, what is fallback, and how detection works.

---

## What is automated

- **Create on X (recommended):** After creating a Space on Linkary, you open X (deep link), create your Space there, then use **Detect my Space**. The backend scores X Spaces (time window + title similarity + scheduled time proximity). It **auto-links only when confident** (single candidate above threshold). If **ambiguous** (multiple candidates), the UI shows a **picker** and the user selects the correct one. If **no match**, the UI shows the **paste fallback**.
- **Connect X:** OAuth 2.0 (PKCE) flow stores tokens in `x_oauth_tokens` so the backend can call the X API on your behalf (e.g. list Spaces by creator for detection).
- **Past stats:** Placeholder cron `/api/cron/xspaces-stats` is in place. When a provider can supply stats for ended Spaces, the job can be extended to fetch and insert `space_stats` rows. Until then, “No stats yet” is shown and the system remains stable.
- **Linkary RSVPs:** Counts and attendee list come from `space_rsvps` and are shown in the Space detail drawer. No X API needed.

---

## What is fallback

- **Manual X Space URL:** If detection finds no match (no Space in 15 minutes, or none pass the score threshold), or the user prefers not to use detection, they can paste an X Space URL. Linkary syncs that Space (via existing sync-from-X flow) and attaches it to the space.
- **X reminders:** UI shows “Not available yet.” X API does not expose reminder counts in the same way; when/if we have a reliable source, we can wire it up.

---

## Token storage and RLS

- **Table:** `x_oauth_tokens`
  - Columns: `profile_id` (PK), `provider` ('x'), `access_token`, `refresh_token`, `expires_at`, `scope`, `x_user_id`, `x_username`, `created_at`, `updated_at`.
- **RLS:** Only the owner can read/insert/update/delete their row:
  - `profile_id = auth.uid()` for SELECT, INSERT, UPDATE, DELETE.
- **APIs:**
  - `POST /api/x/connect` — starts OAuth, redirects to X; callback is `GET /api/x/callback`.
  - `GET /api/x/callback` — exchanges code for tokens, fetches X user (e.g. `/2/users/me`), upserts into `x_oauth_tokens`, redirects to `/xspaces`.
  - `GET /api/x/me` — returns `x_user_id` and `username` from `x_oauth_tokens` for the current user (or 404 if not connected).
- **Env:** `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_OAUTH_COOKIE_SECRET` for the OAuth flow. Callback URL must be allowlisted in the X app (e.g. `https://your-domain.com/api/x/callback`).
- **Security:** No API response must ever include `access_token` or `refresh_token`; they are stored only in `x_oauth_tokens` and used server-side. `/api/x/me` returns only `x_user_id` and `username`.

---

## How detection works

1. User creates a Space on Linkary (title, time, etc.) with **Create on X** enabled.
2. Linkary creates the space row; user is shown **Connect X** (if needed), **Open X Spaces** (deep link), then **Detect my Space**.
3. User opens X, creates a Space there, then returns to Linkary and clicks **Detect my Space**.
4. Backend loads the user’s token from `x_oauth_tokens`, calls X API `GET /2/spaces/by/creator_ids`, and **scores** each Space created in the last 15 minutes:
   - **Time window:** Must be created within 15 minutes.
   - **Title similarity:** Token-based similarity to the Linkary space title; below threshold → never link.
   - **Scheduled time proximity:** If both have scheduled times, they must be within 2 hours; otherwise the candidate is rejected.
5. **Single candidate above threshold (e.g. score ≥ 0.5):** Backend auto-links and returns `linked: true`; UI closes the modal and refreshes. The space row has `x_space_id` and `x_space_url`; user can open “Open on X” from the detail drawer.
6. **Multiple candidates above threshold:** Backend returns `require_selection: true` and `candidates`; UI shows a **picker**. User selects one → client calls **POST /api/xspaces/link-space** with `space_id` and `x_space_id` → space is updated; UI resets and refreshes.
7. **No candidates above threshold:** Backend returns `found: false`; UI shows the **paste fallback** so the user can paste the X Space URL.

---

## Provider capabilities (current)

- **X API v2:** We use OAuth 2.0 tokens from `x_oauth_tokens`. Supported:
  - Spaces by creator: `GET /2/spaces/by/creator_ids` (for “Detect my Space”).
  - User me: `GET /2/users/me` (to store `x_user_id` / `x_username` at callback).
- **twitterapi.io:** Used elsewhere for Space detail by ID and sync-from-URL; no “list my Spaces” endpoint, so detection relies on the X API with stored tokens.
- **Create/schedule on X:** X API and twitterapi.io are retrieval-focused; we do not create or schedule Spaces via API. The flow is: create on X in the app, then link in Linkary via detection or manual paste.
