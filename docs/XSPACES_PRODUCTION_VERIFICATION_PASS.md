# XSpaces Production Verification Pass (Post–Provider Standardization)

## PART 1 — VERIFY sync-from-x IS REALLY USING TWITTERAPI.IO

### 1. Which env variable name the code actually reads

- **xspaces-data-provider.ts** `getProviderApiKey()` (used by `isTwitterApiSpacesConfigured()` and `fetchSpaceByIdFromTwitterApi()`):
  - **TWITTERAPI_IO_KEY** (preferred; checked first)
  - **TWITTERAPI_API_KEY** (fallback if IO key empty)
  - Either can be set; both are read with `.trim()`; empty string is treated as unset.

### 2. Which one is expected in production

- **Both are valid.** Production can set either **TWITTERAPI_IO_KEY** or **TWITTERAPI_API_KEY**. Same key is used for sync-from-x Space-by-ID (twitterapi.io). Other crons (x-analytics-daily, sync-x-tweets-weekly, etc.) currently reference **TWITTERAPI_API_KEY** in their checks; readiness uses **TWITTERAPI_API_KEY**. For sync-from-x specifically, **TWITTERAPI_IO_KEY** or **TWITTERAPI_API_KEY** will enable the twitterapi.io path.

### 3. Whether the route logs clearly show provider = twitterapi.io

- **Currently:** When **DEBUG_SYNC_FROM_X=1**, the route logs `SYNC_PROVIDER_USED: twitterapi.io` and `SYNC_PROVIDER_RESULT`. Without that env var, no provider is logged.
- **Gap:** Production verification without turning on DEBUG_* is not possible.
- **Change:** Add an **always-on** single log line (e.g. `[sync-from-x] PROVIDER_PATH=twitterapi.io` or `PROVIDER_PATH=x_api`) so Vercel logs can prove which path was used without enabling full debug.

### 4. Whether any hidden fallback to official X API still exists

- **Verified:** When `isTwitterApiSpacesConfigured()` is true, the route enters the `if (isTwitterApiSpacesConfigured())` block and:
  - On success: sets `detail`, never enters `if (!detail)`.
  - On failure: returns one of the provider error responses (503/404/502/429); no fallback to X API.
- When the provider key is **not** set, the route skips that block, `detail` stays null, and it enters `if (!detail)` and uses **only** the X API path (fetchXSpaceByIdV2 + refresh/retry). So **no hidden fallback** when key is set; X API is used only when key is unset.

### 5. Whether any old helper is still imported or reachable accidentally

- **sync-from-x** imports: `fetchXSpaceByIdV2`, `spaceParticipantIds`, `XSpaceDetail` from x-analytics-server; `refreshXAccessToken` from x-token-refresh; `fetchSpaceByIdFromTwitterApi`, `isTwitterApiSpacesConfigured` from xspaces-data-provider.
- **fetchXSpaceDetail** (old twitterapi.io helper in x-analytics-server) is **not** imported by sync-from-x; it is only defined in x-analytics-server and not used by sync-from-x. No accidental use.

---

### Exact provider path used now (sync-from-x)

| Condition | Path | Helper |
|-----------|------|--------|
| TWITTERAPI_IO_KEY or TWITTERAPI_API_KEY set | **twitterapi.io only** | `fetchSpaceByIdFromTwitterApi(spaceId)` → GET https://api.twitterapi.io/twitter/spaces/detail?space_id=... (X-API-Key) |
| Neither key set | **Official X API only** | `fetchXSpaceByIdV2(spaceId, accessToken)` → GET https://api.twitter.com/2/spaces/{id} (Bearer) |

### Exact env dependency

- **TWITTERAPI_IO_KEY** (optional) or **TWITTERAPI_API_KEY** (optional). At least one must be set and non-empty for the twitterapi.io path. No other env vars control provider choice for sync-from-x.

### Exact production verification method

1. Set **TWITTERAPI_IO_KEY** or **TWITTERAPI_API_KEY** in Vercel.
2. Trigger **POST /api/spaces/sync-from-x** with a valid Space URL and authenticated user.
3. In Vercel logs, grep for **PROVIDER_PATH** (after adding the always-on log): expect `[sync-from-x] PROVIDER_PATH=twitterapi.io` when key is set, or `PROVIDER_PATH=x_api` when key is unset.
4. Optional: set **DEBUG_SYNC_FROM_X=1** and grep for **SYNC_PROVIDER_USED** and **SYNC_PROVIDER_RESULT** for richer proof.

---

## PART 2 — VERIFY WHAT REMAINS ON OFFICIAL X API

### GET /api/xspaces/my-x-spaces

- **Uses:** `fetchSpacesByCreatorId(xUserId, currentAccessToken, spaceFields)` → **official X API** GET https://api.twitter.com/2/spaces/by/creator_ids (Bearer).
- **No** twitterapi.io call in this route.

### POST /api/xspaces/detect-my-space

- **Uses:** Same `fetchSpacesByCreatorId(...)` → **official X API** (by/creator_ids). Then matches candidates to Linkary space by title/time; uses **spaces** table only for linkary space metadata and link updates.
- **No** twitterapi.io call in this route.

### twitterapi.io list-by-creator equivalent

- **Confirmed:** twitterapi.io docs (llms.txt) list only **Get Space Detail** by space id. There is **no** “spaces by creator” or “list user spaces” endpoint in the current codebase or in the integrated provider docs. So my-x-spaces and detect-my-space **cannot** be moved to twitterapi.io for the list step without a new provider capability.

### Alternate existing data sources

- **spaces** table: has `host_profile_id`, `x_space_id`, `x_space_url`, `title`, `scheduled_at`, etc. Already used by detect-my-space for Linkary space metadata and by link-space/upcoming/past.
- **Possible fallback for my-x-spaces:** When the official X API fails (!result.ok), we can query `spaces` where `host_profile_id = user.id` and return those as a list with a flag (e.g. `spaces_source: "linkary"`) so the UI can show “Showing your Linkary spaces (X list temporarily unavailable)”. This uses **existing** data only; no new platform.

---

## PART 3 — NEXT BEST PRODUCT FIX

**Recommendation: A (with a small slice of B).**

- **A. Keep my-x-spaces and detect-my-space on official X API temporarily; improve truthfulness of UX and fallback behavior.**  
  - Both routes must stay on X API (no twitterapi.io list endpoint). Improve by: (1) honest error messages when X API fails; (2) my-x-spaces: when X API fails, fall back to returning the host’s **existing Linkary spaces** from DB with `spaces_source: "linkary"` so the user still sees something useful and the UI can say the list is from Linkary, not X.

- **B. Partially replace with DB-backed behavior.**  
  - Use only the **already existing** `spaces` table: for my-x-spaces, on X API failure return DB spaces for this host as fallback. No new cache/worker/ingestion; minimal and low-risk.

- **C. Find twitterapi.io-compatible endpoint.**  
  - Not applicable; no list-by-creator endpoint exists.

**Chosen:** **A + minimal B** — Keep X API as primary for list/detect; add **always-on PROVIDER_PATH logs** for all three routes; add **my-x-spaces DB fallback** when X API fails so the UX is honest and fallback is useful.

---

## PART 4 — IF OFFICIAL X API MUST REMAIN, FIX THE PRODUCT BEHAVIOR

1. **Honest UX:** Error responses and client copy already distinguish X_RECONNECT_NEEDED, X_RATE_LIMITED, etc. When we add DB fallback for my-x-spaces, the client can show “Showing your Linkary spaces (X list temporarily unavailable)” when `spaces_source === "linkary"`.
2. **Useful fallback:** my-x-spaces: on `!result.ok`, query `spaces` where `host_profile_id = user.id`, map to the same list shape where possible (id, title, scheduled_at, url from x_space_id/x_space_url), return with `spaces_source: "linkary"`. If no rows, keep current error response.
3. **detect-my-space:** Paste-link path is already prominent; “No match found — paste the link below” is already returned. No change required for detect beyond provider logging.

---

## PART 5 — DEBUG / PROOF

- Add **always-on** (no DEBUG_* gate) production-safe log per route:
  - **sync-from-x:** Log `[sync-from-x] PROVIDER_PATH=twitterapi.io` when the twitterapi.io path is used; log `[sync-from-x] PROVIDER_PATH=x_api` when the X API path is used.
  - **my-x-spaces:** Log `[my-x-spaces] PROVIDER_PATH=x_api` when the X API is called (and optionally when fallback to linkary is used).
  - **detect-my-space:** Log `[detect-my-space] PROVIDER_PATH=x_api` when the X API is called.
- **Never log:** tokens, cookies, auth headers, API keys.

---

## PART 6 — DELIVERABLES (PRE-CODING)

1. **Exact provider verification plan:** Trigger each route; grep Vercel logs for **PROVIDER_PATH**; expect twitterapi.io for sync-from-x when key set, x_api for my-x-spaces and detect-my-space and for sync-from-x when key unset.
2. **Env-variable verification plan:** In Vercel, set **TWITTERAPI_IO_KEY** or **TWITTERAPI_API_KEY**; run sync-from-x; confirm PROVIDER_PATH=twitterapi.io. Unset key; confirm PROVIDER_PATH=x_api.
3. **What still depends on official X API:** my-x-spaces (list by creator), detect-my-space (list by creator for matching). sync-from-x uses X API only when provider key is not set.
4. **Next-best-fix recommendation:** A + minimal B — keep X API for list/detect; add PROVIDER_PATH logs; add my-x-spaces DB fallback when X API fails.
5. **Risks / compatibility:** Adding DB fallback changes my-x-spaces response shape when fallback is used (adds `spaces_source: "linkary"`). Client must handle it (show different message or same list). Low risk; uses existing tables only.

---

## DELIVERABLES (POST-IMPLEMENTATION)

### 1. Files changed

- **apps/web/src/app/api/spaces/sync-from-x/route.ts** — Always-on `PROVIDER_PATH=twitterapi.io` when provider path used; always-on `PROVIDER_PATH=x_api` when X API path used.
- **apps/web/src/app/api/xspaces/my-x-spaces/route.ts** — Always-on `PROVIDER_PATH=x_api`; on X API timeout/invalid/failed, fallback to DB spaces for host, return `spaces_source: "linkary"` and log `PROVIDER_PATH=linkary_fallback`.
- **apps/web/src/app/api/xspaces/detect-my-space/route.ts** — Always-on `PROVIDER_PATH=x_api`.
- **apps/web/src/figma/app/components/XSpacesPage.tsx** — State `myXSpacesSource`; when `spaces_source === "linkary"` show "Showing your Linkary spaces (X list temporarily unavailable)."
- **docs/XSPACES_PRODUCTION_VERIFICATION_PASS.md** — Verification plan and deliverables.

### 2. Exact provider used now by each route

| Route | When | Provider |
|-------|------|----------|
| **POST /api/spaces/sync-from-x** | TWITTERAPI_IO_KEY or TWITTERAPI_API_KEY set | **twitterapi.io only** (no X API fallback). |
| **POST /api/spaces/sync-from-x** | Neither key set | **x_api** (official X API). |
| **GET /api/xspaces/my-x-spaces** | Always (list step) | **x_api**. On failure, fallback returns **linkary** (DB). |
| **POST /api/xspaces/detect-my-space** | Always | **x_api**. |

### 3. Exact env variable(s) used

- **sync-from-x (twitterapi.io path):** **TWITTERAPI_IO_KEY** (preferred) or **TWITTERAPI_API_KEY** (fallback). Read in `xspaces-data-provider.ts` `getProviderApiKey()`; `isTwitterApiSpacesConfigured()` returns true if either is set and non-empty.
- **my-x-spaces / detect-my-space:** No provider-key env; they use **x_oauth_tokens** (user X OAuth) and always call official X API.

### 4. Whether any fallback to official X API still exists

- **When provider key is set:** sync-from-x uses **only** twitterapi.io; **no** fallback to X API.
- **When provider key is not set:** sync-from-x uses the **X API path** by design (not a “fallback” from twitterapi.io; the twitterapi.io block is simply skipped).

### 5. What remains dependent on official X API

- **GET /api/xspaces/my-x-spaces** — List-by-creator (GET /2/spaces/by/creator_ids). Optional DB fallback when X API fails (returns host’s Linkary spaces).
- **POST /api/xspaces/detect-my-space** — Same list-by-creator for candidate matching. Paste-link path remains prominent on failure.

### 6. Smallest product fix implemented

- **Always-on PROVIDER_PATH logs** — So production can prove which provider was used without DEBUG_* (no tokens/keys logged).
- **my-x-spaces DB fallback** — When X API returns timeout/invalid/failed, return the host’s existing Linkary spaces with `spaces_source: "linkary"`; client shows "Showing your Linkary spaces (X list temporarily unavailable)." No fallback for 403/429 (reconnect/rate limit).

### 7. Manual QA checklist

- [ ] **sync-from-x:** Set TWITTERAPI_IO_KEY or TWITTERAPI_API_KEY; trigger Add from X with valid link. In Vercel logs, grep **PROVIDER_PATH** → expect `[sync-from-x] PROVIDER_PATH=twitterapi.io`. Unset key; trigger again → expect `PROVIDER_PATH=x_api`.
- [ ] **my-x-spaces:** Open Add from X with X connected. Grep logs → expect `[my-x-spaces] PROVIDER_PATH=x_api`. Simulate or wait for X API failure (e.g. disconnect / invalid token) and ensure fallback returns Linkary spaces and UI shows "Showing your Linkary spaces (X list temporarily unavailable)."
- [ ] **detect-my-space:** Trigger detect. Grep logs → expect `[detect-my-space] PROVIDER_PATH=x_api`.
- [ ] Add from X (session, sync-from-x success), detect-my-space flow, my-x-spaces list, speaker applications, sponsor proposals, payout preferences, notifications, my-proposals, analytics, reputation, public credibility, profile/dashboard, GET /api/spaces/[id]: unchanged behavior.
- [ ] No tokens, cookies, auth headers, or API keys in logs.

### 8. Confirmation: Add from X and unrelated systems not broken

- **Add from X:** Unchanged; still calls sync-from-x; when key set uses twitterapi.io only; when key unset uses X API. Session refresh and host check unchanged.
- **sync-from-x / detect-my-space / my-x-spaces:** Only provider logging and my-x-spaces fallback added; no change to success paths or auth.
- **Speaker applications, sponsor proposals, payout preferences, notifications, my-proposals, analytics, reputation, public credibility, profile/dashboard, GET /api/spaces/[id]:** Not modified.
