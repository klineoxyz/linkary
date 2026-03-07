# XSpaces Post-Deploy Production Verification

Strict verification only. No redesign. Reference: current codebase as deployed.

---

## PART 1 — LIVE PROVIDER PATHS: EXACT LOG STRINGS AND CONDITIONS

| Route | Provider | Condition | Exact log string (Vercel) |
|-------|----------|-----------|---------------------------|
| **sync-from-x** | twitterapi.io | `isTwitterApiSpacesConfigured()` is true (TWITTERAPI_IO_KEY or TWITTERAPI_API_KEY set and non-empty). Route enters the first branch and logs before calling `fetchSpaceByIdFromTwitterApi`. | `[sync-from-x] PROVIDER_PATH=twitterapi.io` |
| **sync-from-x** | x_api | `isTwitterApiSpacesConfigured()` is false (both keys empty/unset). `detail` stays null; route enters `if (!detail)` and logs before reading x_oauth_tokens. | `[sync-from-x] PROVIDER_PATH=x_api` |
| **my-x-spaces** | x_api | User has token row with access_token and x_user_id. Route logs immediately after "token row found" and before calling `fetchSpacesByCreatorId`. | `[my-x-spaces] PROVIDER_PATH=x_api` |
| **my-x-spaces** | linkary_fallback | Same as x_api path, but `result.ok` is false and `result.code` is one of: X_API_TIMEOUT, INVALID_X_RESPONSE, X_API_FAILED; and the DB query for `spaces` where `host_profile_id = user.id` returns at least one row. Route returns `{ spaces, spaces_source: "linkary" }` and logs. | `[my-x-spaces] PROVIDER_PATH=linkary_fallback` |
| **detect-my-space** | x_api | User has token row with access_token and x_user_id; rate limit not exceeded. Route logs after "token row found" and before calling `fetchSpacesByCreatorId`. | `[detect-my-space] PROVIDER_PATH=x_api` |

Notes:
- **sync-from-x:** Only one of the two log lines is emitted per request (either twitterapi.io or x_api).
- **my-x-spaces:** Either `PROVIDER_PATH=x_api` (always when X API is called) and then on failure possibly `PROVIDER_PATH=linkary_fallback` if fallback is taken. So for a single request you see `x_api` first; if X API fails and fallback runs, you also see `linkary_fallback`.

---

## PART 2 — ENV EXPECTATION

| Question | Answer |
|----------|--------|
| **Which env vars enable twitterapi.io for sync-from-x?** | **TWITTERAPI_IO_KEY** or **TWITTERAPI_API_KEY**. Either one set and non-empty enables the twitterapi.io path. |
| **Are both supported?** | **Yes.** Both are supported. **TWITTERAPI_IO_KEY** is preferred (checked first); **TWITTERAPI_API_KEY** is fallback. |
| **Which file reads them?** | **apps/web/src/lib/xspaces-data-provider.ts** — function `getProviderApiKey()`: `process.env.TWITTERAPI_IO_KEY?.trim() \|\| process.env.TWITTERAPI_API_KEY?.trim() \|\| null`. Used by `isTwitterApiSpacesConfigured()` (returns `getProviderApiKey() != null`). |
| **What if both are empty/unset?** | `getProviderApiKey()` returns `null`. `isTwitterApiSpacesConfigured()` is false. sync-from-x uses the **x_api** path (x_oauth_tokens + official X API). No twitterapi.io call. |

---

## PART 3 — PRODUCTION QA PLAN (MINIMAL STEP-BY-STEP)

### Test 1: sync-from-x uses twitterapi.io (provider key set)

| Step | Action |
|------|--------|
| 1. Trigger | In production UI: open XSpaces → Add from X → paste a valid X Space URL → click "Add from X" (or "Link pasted URL" / Import from list). |
| 2. Request | **POST /api/spaces/sync-from-x** with body `{ "url": "https://x.com/i/spaces/<id>" }` and Bearer session. |
| 3. Log line | In Vercel logs for that request, search for: **`[sync-from-x] PROVIDER_PATH=twitterapi.io`**. |
| 4. Success | Log line appears; response is 200 with `space` (or 409 ALREADY_IMPORTED, or 403 X_NOT_HOST, or 404/502/429 with provider codes). **No** `PROVIDER_PATH=x_api` for the same request. |
| 5. Broken | `PROVIDER_PATH=x_api` appears instead (wrong path), or 503 PROVIDER_NOT_CONFIGURED when key is supposed to be set, or no PROVIDER_PATH line at all. |

### Test 2: sync-from-x uses x_api (provider key not set)

| Step | Action |
|------|--------|
| 1. Trigger | Same as Test 1, in an environment where **both** TWITTERAPI_IO_KEY and TWITTERAPI_API_KEY are unset or empty. |
| 2. Request | Same **POST /api/spaces/sync-from-x**. |
| 3. Log line | Search for: **`[sync-from-x] PROVIDER_PATH=x_api`**. |
| 4. Success | Log line appears; flow uses x_oauth_tokens (success or 403 X_RECONNECT_NEEDED / 502 / 429 etc.). **No** `PROVIDER_PATH=twitterapi.io`. |
| 5. Broken | `PROVIDER_PATH=twitterapi.io` appears when keys are unset, or no PROVIDER_PATH line. |

### Test 3: my-x-spaces uses x_api (and optional linkary_fallback)

| Step | Action |
|------|--------|
| 1. Trigger | XSpaces → Add from X (or any flow that loads "Past X Spaces (last 30 days)"). User must be connected to X. |
| 2. Request | **GET /api/xspaces/my-x-spaces** with Bearer session. |
| 3. Log line | Search for: **`[my-x-spaces] PROVIDER_PATH=x_api`**. If X API fails and host has Linkary spaces: **`[my-x-spaces] PROVIDER_PATH=linkary_fallback`**. |
| 4. Success | `PROVIDER_PATH=x_api` appears. Response 200 with `spaces` (array). If X API failed and fallback ran: also `linkary_fallback` and response includes `spaces_source: "linkary"` and UI shows "Showing your Linkary spaces (X list temporarily unavailable)." |
| 5. Broken | No PROVIDER_PATH line; or 403/502 with no fallback when X API failed and user has Linkary spaces. |

### Test 4: detect-my-space uses x_api

| Step | Action |
|------|--------|
| 1. Trigger | Create a Space (or open one without X link) → use "Detect" / "Link from X" flow that calls detect-my-space. |
| 2. Request | **POST /api/xspaces/detect-my-space** with body `{ "space_id": "<linkary-space-id>" }` (and optional `selected_x_space_id`), Bearer session. |
| 3. Log line | Search for: **`[detect-my-space] PROVIDER_PATH=x_api`**. |
| 4. Success | Log line appears; response is 200 with `found` true/false, or candidates, or 403/429/502 as designed. |
| 5. Broken | No PROVIDER_PATH line; or wrong provider. |

---

## PART 4 — NEXT DECISION

**If sync-from-x works through twitterapi.io, is there any further backend work needed right now?**  
**No.** With the provider key set, sync-from-x is off the official X API for Space-by-ID. No immediate backend change is required for that route.

**If detect-my-space still fails because it stays on x_api, should we:**  
**A. Keep manual paste-link as the product answer for now.**

- detect-my-space depends on **list-by-creator** from the official X API; twitterapi.io has no equivalent endpoint in the current product/docs.
- Paste-link is already in the UI and works with sync-from-x (twitterapi.io or x_api). So when detect fails (e.g. X token/rate limit), the user can paste the X Space URL and complete the flow.
- Building a new detect strategy (e.g. from existing Linkary data) would be a larger product/backend change and is not required for the current architecture or for verifying this deploy.

---

## DELIVERABLES SUMMARY

### 1. Exact expected provider per route

| Route | Expected provider(s) |
|-------|----------------------|
| **POST /api/spaces/sync-from-x** | **twitterapi.io** when TWITTERAPI_IO_KEY or TWITTERAPI_API_KEY set; **x_api** when both unset/empty. |
| **GET /api/xspaces/my-x-spaces** | **x_api** (primary). **linkary_fallback** when X API returns timeout/invalid/failed and host has ≥1 Linkary space. |
| **POST /api/xspaces/detect-my-space** | **x_api** only. |

### 2. Exact env requirements

- **twitterapi.io for sync-from-x:** At least one of **TWITTERAPI_IO_KEY** or **TWITTERAPI_API_KEY** set and non-empty (read in **apps/web/src/lib/xspaces-data-provider.ts**).
- **x_api for sync-from-x:** Both keys unset or empty.

### 3. Exact Vercel log lines to look for

| Log line | Meaning |
|----------|---------|
| `[sync-from-x] PROVIDER_PATH=twitterapi.io` | sync-from-x used twitterapi.io for this request. |
| `[sync-from-x] PROVIDER_PATH=x_api` | sync-from-x used official X API for this request. |
| `[my-x-spaces] PROVIDER_PATH=x_api` | my-x-spaces called the X API (always when list is loaded). |
| `[my-x-spaces] PROVIDER_PATH=linkary_fallback` | my-x-spaces fell back to Linkary DB after X API failure. |
| `[detect-my-space] PROVIDER_PATH=x_api` | detect-my-space called the X API. |

### 4. Exact pass/fail QA checklist

- [ ] **sync-from-x (key set):** Trigger Add from X with valid Space URL → Vercel shows `[sync-from-x] PROVIDER_PATH=twitterapi.io` for that request. **Pass.** If `PROVIDER_PATH=x_api` or 503 PROVIDER_NOT_CONFIGURED (and key is set) → **Fail.**  
- [ ] **sync-from-x (key unset):** Same trigger with key unset → Vercel shows `[sync-from-x] PROVIDER_PATH=x_api`. **Pass.** If `PROVIDER_PATH=twitterapi.io` → **Fail.**  
- [ ] **my-x-spaces:** Load Add from X with X connected → Vercel shows `[my-x-spaces] PROVIDER_PATH=x_api`; 200 and `spaces` array. **Pass.** If X API fails and user has Linkary spaces, `PROVIDER_PATH=linkary_fallback` and `spaces_source: "linkary"` → **Pass.** No PROVIDER_PATH or wrong path → **Fail.**  
- [ ] **detect-my-space:** Trigger detect flow → Vercel shows `[detect-my-space] PROVIDER_PATH=x_api`. **Pass.** No line or wrong path → **Fail.**  
- [ ] **No regressions:** Add from X (session/refresh), sync-from-x success/error codes, detect flow, my-x-spaces list, speaker/sponsor/payout/notifications/my-proposals/analytics/reputation/credibility/profile/GET /api/spaces/[id] behave as before. **Pass.** Any of these broken → **Fail.**  

### 5. Whether any more coding is needed immediately

**No.** Current architecture is implemented and verified by the log lines above. Next step is to run the QA checklist in production after deploy. If detect-my-space fails in production due to X API (token/rate limit), the product answer for now is **manual paste-link** (option A); no new detect strategy or backend work is required for this verification pass.
