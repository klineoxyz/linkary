# XSpaces Automation V1

What is automated, what is fallback, and how detection works.

---

## What is automated

- **Create on X (recommended):** After creating a Space on Linkary, you can open X (deep link to X Spaces), create your Space on X, then use **Detect my Space** in Linkary. The app polls the X API for Spaces created by you in the last 15 minutes and links the first match to your Linkary space (`x_space_id`, `x_space_url`).
- **Connect X:** OAuth 2.0 (PKCE) flow stores tokens in `x_oauth_tokens` so the backend can call the X API on your behalf (e.g. list Spaces by creator for detection).
- **Past stats:** Placeholder cron `/api/cron/xspaces-stats` is in place. When a provider can supply stats for ended Spaces, the job can be extended to fetch and insert `space_stats` rows. Until then, “No stats yet” is shown and the system remains stable.
- **Linkary RSVPs:** Counts and attendee list come from `space_rsvps` and are shown in the Space detail drawer. No X API needed.

---

## What is fallback

- **Manual X Space URL:** If auto-detect fails (no Space found in 15 minutes, or X not connected), you can paste an X Space URL. Linkary will sync that Space (via existing sync-from-X or sync-from-URL flow) and attach it to the space.
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

---

## How detection works

1. User creates a Space on Linkary (title, time, etc.) with **Create on X** enabled.
2. Linkary creates the space row; user is shown **Step 1: Open X Spaces** (deep link) and **Step 2: Detect my Space**.
3. User opens X, creates a Space there, then returns to Linkary and clicks **Detect my Space**.
4. Backend loads the user’s token from `x_oauth_tokens`, calls X API `GET /2/spaces/by/creator_ids?user_ids=<x_user_id>`, and filters Spaces created in the last 15 minutes.
5. The most recent such Space is chosen; its ID and URL are written to the Linkary space (`x_space_id`, `x_space_url`). If no Space is found, the UI shows the fallback prompt to paste the X Space URL.

---

## Provider capabilities (current)

- **X API v2:** We use OAuth 2.0 tokens from `x_oauth_tokens`. Supported:
  - Spaces by creator: `GET /2/spaces/by/creator_ids` (for “Detect my Space”).
  - User me: `GET /2/users/me` (to store `x_user_id` / `x_username` at callback).
- **twitterapi.io:** Used elsewhere for Space detail by ID and sync-from-URL; no “list my Spaces” endpoint, so detection relies on the X API with stored tokens.
- **Create/schedule on X:** X API and twitterapi.io are retrieval-focused; we do not create or schedule Spaces via API. The flow is: create on X in the app, then link in Linkary via detection or manual paste.
