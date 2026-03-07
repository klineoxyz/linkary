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

## 5. Second provider / fallback (proposal only — not implemented)

If evidence shows that upcoming Spaces are routinely 404 from twitterapi.io and we need them:

- **Narrow fallback:** On sync-from-x, when **twitterapi.io** returns **SPACE_NOT_FOUND** (404), **before** returning 404 to the user:
  1. If the user has a valid X OAuth token (same as today’s X API path): call **official X API** `GET /2/spaces/{id}` with that token.
  2. If X returns 200 with a Space: use that payload to complete sync (host check, insert/update) and return 200.
  3. If X returns 404 or other failure: return current 404 SPACE_NOT_FOUND and message as above.

- **Plug-in point:** In `apps/web/src/app/api/spaces/sync-from-x/route.ts`, inside the `if (isTwitterApiSpacesConfigured())` block, in the `else` branch where we handle `code === "SPACE_NOT_FOUND"`: instead of immediately returning 404, check for user’s X token; if present, call `fetchXSpaceByIdV2(spaceId, accessToken)` (existing helper); if result.space, continue with same host-check and insert logic as the current X API path (reuse existing code path), then return 200; otherwise return 404 as today.

- **Scope:** Only sync-from-x; only on provider 404; no new env flags, no multi-provider abstraction. Optional: rate-limit or cap fallback calls to avoid burning X API credits for every 404.

- **Not in scope:** Broad multi-provider system; changing detect-my-space or my-x-spaces; analytics/dashboard/profile/notifications/speakers/sponsors/payouts/visibility.

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
