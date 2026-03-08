# XSpaces Provider (twitterapi.io) — Space State Evidence and Conclusions

## Purpose

Determine from documentation and production evidence whether twitterapi.io supports **upcoming/scheduled**, **live**, and **ended** X Spaces in our sync-from-x integration, and apply the smallest production-safe handling based on that evidence.

---

## 1. Provider documentation (twitterapi.io)

- **Endpoint:** `GET https://api.twitterapi.io/twitter/spaces/detail?space_id=<id>`
- **Documented response (200):** `data` with `id`, `title`, **`state`** (e.g. NotStarted / Live / Ended), **`scheduled_start`**, `created_at`, `updated_at`, `creator`, `participants`, etc.
- **Documented states:** "State of the Space, e.g. **NotStarted/Live/Ended**" — i.e. **upcoming (NotStarted), live, and ended are all documented**.
- **Documented error:** 400 with error schema; 404 is not explicitly documented but is returned in practice when the Space is not found.

**Conclusion from docs:** twitterapi.io **documents** support for NotStarted (scheduled/upcoming), Live, and Ended. So by spec, upcoming Spaces are supported.

**Doc consistency (corrected):** Section 5 now describes the official X API fallback as **implemented** (current behavior). Section 8 describes viability, logs, and implementation detail. Section 9 provides the production verification runbook and result template for one post-deploy test with a real upcoming Space URL.

---

## 2. Evidence table (fill from production logs or controlled tests)

For each test, paste the Space URL, call `POST /api/spaces/sync-from-x` with `{ "url": "<pasted_url>" }`, then from server logs copy:

- `[sync-from-x] PROVIDER_VERIFY` → normalized_pasted_url, parsed_space_id, endpoint_path, sanitized_query_params, provider_status, provider_code, provider_message, data_id, data_state, data_scheduled_start
- Final app response: status, code, error message shown to user

| Space state (intended) | Pasted URL | parsed_space_id | endpoint_path | sanitized_query_params | provider_status | provider_code | provider_message | data.id | data.state | data.scheduled_start | Final app response |
|------------------------|------------|-----------------|---------------|------------------------|-----------------|---------------|------------------|---------|------------|----------------------|---------------------|
| Upcoming/scheduled public | *(e.g. x.com/i/spaces/1YpKkzwXQNjKj)* | *(from log)* | /twitter/spaces/detail | { space_id: "..." } | 404 | SPACE_NOT_FOUND | *(if any)* | — | — | — | 404, SPACE_NOT_FOUND, backend message |
| Currently live public | *(paste live Space URL)* | *(from log)* | /twitter/spaces/detail | { space_id: "..." } | *(200 or 404)* | *(OK or SPACE_NOT_FOUND)* | | *(if 200)* | *(e.g. Live)* | *(if present)* | 200 + space or 404 |
| Ended public (if available) | *(paste ended Space URL)* | *(from log)* | /twitter/spaces/detail | { space_id: "..." } | *(200 or 404)* | | | | *(e.g. Ended)* | | |
| Invalid / private / unavailable | *(invalid or private link)* | *(from log)* | /twitter/spaces/detail | { space_id: "..." } | 404 | SPACE_NOT_FOUND | | — | — | — | 404, SPACE_NOT_FOUND |

**How to fill:** Run sync-from-x for each row; read `PROVIDER_VERIFY` and `[xspaces-provider]` from server logs; record response and user-facing error.

**Production evidence so far:**

- **Upcoming/scheduled:** At least one real user-reported case: pasted direct `x.com/i/spaces/<id>` link for an **upcoming** Space → provider returned **404** → app returns 404 SPACE_NOT_FOUND. Logs confirm correct `parsed_space_id` and request shape; 404 is from provider, not parsing.

---

## 3. Conclusions (evidence-based)

| Question | Answer |
|----------|--------|
| Does twitterapi.io **document** support for upcoming/scheduled Spaces? | **Yes.** State "NotStarted" and field `scheduled_start` are documented. |
| Does twitterapi.io support upcoming Spaces **in practice** in our integration? | **Unclear / not reliable.** Docs say yes; production shows 404 for at least one upcoming Space. So either indexing delay, or only a subset of scheduled Spaces are in the provider’s index. |
| Does it only support live Spaces? | **No.** Docs explicitly include NotStarted and Ended. We have no evidence that it *only* returns 200 for live. |
| Does it support ended Spaces? | **Documented yes.** No production evidence table entry yet; fill when an ended Space is tested. |
| Are the 404s caused by provider indexing delay / lack of coverage? | **Likely.** Request construction is correct (proven by logs). 404 with correct `space_id` points to provider coverage/indexing, not a Linkary bug. |

**Summary:** twitterapi.io **documents** NotStarted/Live/Ended. In practice, at least one **upcoming** Space returns 404, so **upcoming Spaces are not reliably available** from the provider for our integration. We do not have proof that *all* upcoming Spaces fail (could be delay or partial coverage). So we do not claim "upcoming not supported"; we add **truthful, evidence-based** copy: scheduled Spaces **may** not be in the provider’s index yet, with actionable guidance (try again closer to start time or after it has started).

---

## 4. Minimal product-safe handling (implemented)

- **When:** sync-from-x uses twitterapi.io and returns **SPACE_NOT_FOUND** (404).
- **Change:** One additional sentence in the error message, only for the twitterapi.io path:  
  **"If this is a scheduled Space, it may not be in the provider's index yet; try again closer to start time or after it has started."**
- **Rationale:** Evidence supports that *some* scheduled Spaces get 404 (indexing/coverage). We do not assert that *all* scheduled Spaces fail. The copy is conditional ("If this is a scheduled Space") and suggests retry/later — no invented certainty.

**Full message (twitterapi.io path, SPACE_NOT_FOUND):**  
"This Space could not be found by the current X data provider. It may be unavailable, private, deleted, or not yet indexed. If this is a scheduled Space, it may not be in the provider's index yet; try again closer to start time or after it has started."

---

## 5. Official X API fallback (implemented)

When **twitterapi.io** returns **SPACE_NOT_FOUND** (404), sync-from-x now attempts a narrow fallback before returning 404:

1. Look up the user’s X OAuth token in `x_oauth_tokens` (same table as the primary X API path).
2. If a token exists: call **official X API** `GET /2/spaces/{id}` once with that token (no refresh in fallback).
3. If X returns 200 and the user is host: use that payload (title, scheduled_start), run host check, then complete sync and return 200. Participant list is not synced on this path (X API v2 response has no participants).
4. If X returns 404, 402, 401, 429, timeout, or no token: return the same 404 SPACE_NOT_FOUND and existing message; we do not surface 402 or other X errors to the user on fallback.

**Location:** `apps/web/src/app/api/spaces/sync-from-x/route.ts`, inside the twitterapi.io branch, in the `code === "SPACE_NOT_FOUND"` handler. No new env flags; no change to detect-my-space or my-x-spaces. Unrelated areas (analytics, dashboard, profile, etc.) unchanged.

---

## 6. Exact files changed (this pass)

| File | Change |
|------|--------|
| **docs/XSPACES_PROVIDER_SPACE_STATE_EVIDENCE.md** | New. Evidence table, doc vs practice conclusions, minimal handling rationale, fallback proposal. |
| **apps/web/src/app/api/spaces/sync-from-x/route.ts** | SPACE_NOT_FOUND error message (twitterapi.io path only): add one sentence for scheduled Spaces (evidence-based). |

No other files modified. No changes to: analytics, reputation, dashboard, profile, notifications, proposals, payouts, speakers, sponsors, visibility, auth flows, detect-my-space logic, my-x-spaces, xspaces-data-provider (beyond existing logging), or parseXSpaceId.

---

## 7. Confirmation

- **Unrelated product areas:** Not changed. Scope limited to sync-from-x SPACE_NOT_FOUND message (twitterapi.io path) and this evidence doc.
- **Behavior change:** Users see one extra sentence when sync-from-x returns 404 from the provider, giving actionable guidance if the Space is scheduled.

---

## 8. X API fallback implementation (surgical)

### Viability summary

- **Auth:** User’s X OAuth token is available via existing `x_oauth_tokens` lookup (same table as primary X API path). No new auth flow.
- **Credits:** Official X API can return 402 (X_CREDITS_DEPLETED). Fallback does not surface 402 to the user: on any non-success (402, 404, 401, 429, timeout) we log and return the same 404 SPACE_NOT_FOUND response. UX is unchanged or better (sync can succeed when X has the Space).
- **Scope:** One extra call to `fetchXSpaceByIdV2` only when provider returns 404 and user has a token. No refresh in fallback (single attempt); no change to detect-my-space or my-x-spaces.

**Conclusion:** Fallback is technically viable and implemented in sync-from-x only.

### New structured logs (no secrets)

When provider returns SPACE_NOT_FOUND we log one of:

- **Fallback attempted with token:**  
  `[sync-from-x] X_API_FALLBACK` with JSON:  
  `fallback_attempted: true`, `x_api_fallback_status` (200 or X HTTP status), `x_api_fallback_code` ("OK" or X failure code), `fallback_succeeded: true | false`.

- **Fallback not attempted (no token):**  
  `[sync-from-x] X_API_FALLBACK` with JSON:  
  `fallback_attempted: false`, `reason: "no_token"`.

Existing `[xspaces] sync_space_not_found` and PROVIDER_VERIFY logging unchanged.

### Fallback implementation — files and behavior

- **File changed:** `apps/web/src/app/api/spaces/sync-from-x/route.ts` only.
- **Behavior:** When twitterapi.io returns SPACE_NOT_FOUND we look up the user’s X token; if present we call official X API GET /2/spaces/{id}. On 200 and host check pass we set title/scheduledAt and complete sync (200). On 402/404/401/429/timeout or no token we return the same 404 SPACE_NOT_FOUND and message as before. Participant sync is not run for fallback path (X API v2 response has no participants list).
- **Unrelated areas:** detect-my-space, my-x-spaces, analytics, reputation, dashboard, profile, notifications, proposals, payouts, speakers, sponsors, visibility, auth — unchanged.

---

## 9. Production verification (post-deploy test)

One controlled test with a **real** pasted Space URL should be run after deploy. Execute in your environment (this doc cannot run production requests).

**Current route behavior:** sync-from-x uses **twitterapi.io only**. No official X API. No fallback. One structured log per request: `[sync-from-x] SYNC_OUTCOME` (see section 10).

### Test steps

1. Deploy the sync-from-x route.
2. As a user who **hosts** an upcoming/scheduled public X Space and has **X connected** in Linkary (so `x_oauth_tokens` has a row for that user), paste the direct Space URL into the sync-from-x flow (e.g. Create modal “Link pasted URL” or Add from X paste).  
   Use a URL of the form `https://x.com/i/spaces/<id>` or `x.com/i/spaces/<id>`.
3. Capture from server logs the **single** `[sync-from-x] SYNC_OUTCOME` line; final HTTP status and response body; and whether the Space was created in Linkary.

### Result template (fill after the run)

| Field | Value |
|-------|--------|
| Pasted URL form | *(e.g. https://x.com/i/spaces/1YpKkzwXQNjKj)* |
| parsed_space_id | *(from SYNC_OUTCOME)* |
| provider_status | *(from SYNC_OUTCOME)* |
| provider_code | *(from SYNC_OUTCOME)* |
| final_app_status | *(from SYNC_OUTCOME)* |
| final_app_code | *(from SYNC_OUTCOME)* |
| fallback_used | false |
| Final sync-from-x HTTP status | *(e.g. 200 or 404)* |
| Space created/synced in Linkary? | yes / no |

**Success:** provider_status 200, provider_code "OK", final_app_status 200, Space created in Linkary. **Failure (not indexed):** provider_status 404, provider_code "SPACE_NOT_FOUND", final_app_status 404 — Space not found by twitterapi.io (e.g. not indexed, private, or deleted).

---

## 10. Final verification pass (code inspection + expected log)

**Scope:** Verification only. No code changes.

### Code inspection result

- **sync-from-x** imports only `fetchSpaceByIdFromTwitterApi` and `isTwitterApiSpacesConfigured` from `xspaces-data-provider`. It does **not** import or call `fetchXSpaceByIdV2`, `refreshXAccessToken`, or read `x_oauth_tokens` for Space lookup.
- The only outbound Space fetch is `fetchSpaceByIdFromTwitterApi(spaceId)`, which in `xspaces-data-provider.ts` calls **GET https://api.twitterapi.io/twitter/spaces/detail?space_id=&lt;id&gt;** with the server-side API key. No request to api.twitter.com or any official X API occurs in this route.
- There is no fallback branch: on provider 404 the route returns 404 with the existing message and logs SYNC_OUTCOME; it does not call the official X API.

**Conclusion:** The route is behaving as intended: twitterapi.io only, no official X API usage, no fallback.

### Real production log example (expected format)

The route emits **one** structured log line per request when the provider path is used. Format:

```
[sync-from-x] SYNC_OUTCOME <JSON>
```

**Example — sync success (twitterapi.io returned 200, host check passed):**

```json
{
  "route": "sync-from-x",
  "provider_used": "twitterapi.io",
  "parsed_space_id": "1YpKkzwXQNjKj",
  "provider_status": 200,
  "provider_code": "OK",
  "final_app_status": 200,
  "final_app_code": "OK",
  "fallback_used": false
}
```

**Example — Space not found / not indexed (twitterapi.io returned 404):**

```json
{
  "route": "sync-from-x",
  "provider_used": "twitterapi.io",
  "parsed_space_id": "1YpKkzwXQNjKj",
  "provider_status": 404,
  "provider_code": "SPACE_NOT_FOUND",
  "final_app_status": 404,
  "final_app_code": "SPACE_NOT_FOUND",
  "fallback_used": false
}
```

A **real** production log line is produced when you run one POST to `/api/spaces/sync-from-x` with a pasted Space URL in your environment; capture that line to confirm the route behavior in production.

### Final verification summary

| Check | Result |
|-------|--------|
| Route uses only twitterapi.io for Space data | Yes — single call to `fetchSpaceByIdFromTwitterApi(spaceId)` → GET /twitter/spaces/detail?space_id=&lt;id&gt; |
| Official X API used in this route | No |
| Fallback to X API on 404 | No |
| One structured log per request (route, provider_used, parsed_space_id, provider_status, provider_code, final_app_status, final_app_code, fallback_used) | Yes — `logSyncOutcome()` at every return path in the provider branch |
| No secrets / tokens / cookies in log | Yes |

### Tested Space outcome (to be filled when you run one real request)

- **If the Space synced successfully:** provider_status 200, provider_code "OK", final_app_status 200; Space created in Linkary.
- **If the Space failed because twitterapi.io returned not found / not indexed:** provider_status 404, provider_code "SPACE_NOT_FOUND", final_app_status 404; user sees the existing 404 message (including scheduled-Space guidance). No fallback; no X API call.

### Explicit confirmation: no other product area changed

Only `apps/web/src/app/api/spaces/sync-from-x/route.ts` was modified in the "twitterapi.io only" change. detect-my-space, my-x-spaces, xspaces-data-provider, x-analytics-server, x-api-client, x-token-refresh, and all other routes and features (analytics, reputation, dashboard, profile, notifications, proposals, payouts, speakers, sponsors, visibility, auth) were not changed in that pass or in this verification pass. This verification pass changed only this document (new section 10).
