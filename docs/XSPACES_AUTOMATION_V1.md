# XSpaces Automation V1

What is automated, what is fallback, and how detection works.

---

## Source of truth for X connection

**Decision: Supabase `x_oauth_tokens` is the single source of truth.**

- **`/api/x/me`** reads only from `public.x_oauth_tokens`. It never checks CDP or any other store for “X connected” in the XSpaces context.
- **OAuth flow:** When the user completes our X OAuth (PKCE) flow, the callback **`GET /api/x/callback`** exchanges the code for tokens and **upserts into `x_oauth_tokens`** using the **Supabase service role** (bypasses RLS). No tokens are ever returned in API responses.
- **CDP / Coinbase:** CDP XAuth is used for wallet (e.g. “Link wallet with X”), not for XSpaces. XSpaces “Connect X” and “Detect my Space” use only the tokens stored in `x_oauth_tokens`. If we later support CDP as an alternative provider, we would extend the schema (e.g. `provider = 'cdp'`) and have `/api/x/me` or detect endpoints check CDP when appropriate; today we do not.
- **Detect:** `POST /api/xspaces/detect-my-space` loads the token from `x_oauth_tokens` (by `profile_id = auth.uid()`). No token is ever sent to the client or logged.

---

## Identity mapping

- **`x_oauth_tokens.profile_id`** is the Supabase auth user id (`auth.uid()`). The table has a FK to `profiles(id)`; in this app we assume **`profiles.id = auth.uid()`** (one profile per auth user, created with the same id).
- **DEV-only check:** When `NODE_ENV !== 'production'`, **`GET /api/dev/identity`** (Bearer required) returns `{ auth_user_id, profile_id, email }` so you can verify that `profile_id` (from `profiles` where `id = auth_user_id`) matches `auth_user_id`. If they differ, ensure all code uses the same key (we use `user.id` from `supabase.auth.getUser()` as `profile_id` in the OAuth cookie and in all lookups).

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
  - `GET /api/x/callback` — exchanges code for tokens, fetches X user (e.g. `/2/users/me`), **upserts into `x_oauth_tokens` using the service role**, then re-selects the row to verify; on any failure redirects to `/xspaces?x_oauth_error=1` (no details in URL). Success redirects to `/xspaces?x_connected=1`.
  - `GET /api/x/me` — **always returns 200** when the request is valid. Body: `{ connected: boolean, x_user_id: string|null, username: string|null, provider: 'supabase'|null }`. Never returns tokens; never returns 404 for “not connected” (use `connected: false`).
- **Env:** `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_OAUTH_COOKIE_SECRET`, and **`SUPABASE_SERVICE_ROLE_KEY`** (required for the callback to write to `x_oauth_tokens`). Callback URL must be allowlisted in the X app (e.g. `https://your-domain.com/api/x/callback`).
- **Security:** No API response must ever include `access_token` or `refresh_token`; they are stored only in `x_oauth_tokens` and used server-side. `/api/x/me` returns only `connected`, `x_user_id`, `username`, and `provider`.
- **Rate limit (detect):** `POST /api/xspaces/detect-my-space` is limited to **10 requests per minute per profile_id**. When exceeded, the API returns **429** with body `{ error: "Too many detection requests. Try again in a minute.", code: "RATE_LIMITED", resetAt }`. Rate limiting is durable: Upstash Redis is used when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set; otherwise the Supabase `rate_limits` table (via `consume_rate_limit` RPC) is used. If both Upstash and Supabase service role are unavailable, the API returns **503** with body `{ error: "Rate limit service unavailable." }` (no bypass). Every response after the rate limit check includes safe debug headers: `X-RateLimit-Limit: 10`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (ISO timestamp).

---

## Rate limit observability and fallback

- **How to verify Upstash is being used:** Ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in the environment. Call `POST /api/xspaces/detect-my-space` with valid auth and inspect the response headers: you should see `X-RateLimit-Limit: 10`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. The slot is consumed in Upstash Redis when both env vars are present and the request succeeds.
- **How to verify Supabase fallback is used:** Unset or remove `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (keep `SUPABASE_SERVICE_ROLE_KEY` set). Call the detect endpoint again; rate limiting still applies and the same headers are returned, with the counter stored in the Supabase `rate_limits` table.
- **How to verify 503 when both unavailable:** Unset both Upstash env vars and `SUPABASE_SERVICE_ROLE_KEY`. The detect endpoint returns **503** with message "Rate limit service unavailable." (no rate limit bypass).

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

---

## Why x_oauth_tokens might be empty (root cause)

If `SELECT * FROM public.x_oauth_tokens` returns 0 rows in production, possible causes:

1. **Callback not writing:** Callback uses **service role** to upsert. If `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong in the environment where the callback runs, the client is created with no/wrong key and the upsert may fail or be a no-op. The callback now redirects to `x_oauth_error=1` on any failure (including missing service key).
2. **Cookie not sent:** The OAuth state (including `profile_id`) is in a signed cookie. If the callback runs on a different domain or the cookie is not sent (e.g. SameSite, secure), the callback will redirect to `x_oauth_error=1` and no row is written.
3. **FK violation:** `x_oauth_tokens.profile_id` references `profiles(id)`. If the auth user has no row in `profiles`, or `profiles.id` ≠ auth user id, the upsert fails and the callback redirects to `x_oauth_error=1`. Use the DEV endpoint `GET /api/dev/identity` (when not in production) to confirm `auth_user_id` and `profile_id` match and a profile exists.
4. **Callback URL / env mismatch:** Wrong redirect_uri in the X app, or wrong env (e.g. different `NEXT_PUBLIC_SUPABASE_URL` or keys) so the callback never runs or talks to a different project.

---

## Verification checklist (no secrets)

- **SQL (Supabase store):**  
  `SELECT profile_id, x_user_id, x_username, scope, expires_at, updated_at FROM public.x_oauth_tokens ORDER BY updated_at DESC LIMIT 20;`  
  After a successful Connect X flow, the current user’s `profile_id` should appear with non-null `x_user_id`/`x_username`.

- **UI (connected):** On `/xspaces`, when a row exists for the current user: the top bar shows **“Connected”** (disabled) and **“Reconnect”**; the “Connect X” button is not shown. Banner “Not linked to X yet” does not show a Connect X button when connected.

- **UI (not connected):** When no row exists: top bar shows **“Connect X”**; “Detect my Space” is disabled until connected.

- **Failure:** After a failed OAuth (e.g. user denies, or callback error), redirect goes to `/xspaces?x_oauth_error=1`. The page shows **“X connection failed, please try again.”** (and the param is removed from the URL).
