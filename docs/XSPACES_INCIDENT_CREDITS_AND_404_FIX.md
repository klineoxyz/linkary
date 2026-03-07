# XSpaces Incident Fix: Credits Depleted + SPACE_NOT_FOUND

## Pre-coding: diagnosis and plan

### 1. Exact diagnosis per route

| Route | Production fact | Diagnosis |
|-------|-----------------|-----------|
| **detect-my-space** | PROVIDER_PATH=x_api; X returns 402; body title CreditsDepleted; final_code X_API_FAILED | detect-my-space uses official X API list-by-creator. X API returns **402 Payment Required** with body indicating credits depleted. Code currently maps 402 to generic X_API_FAILED and returns 502. **Fix:** Map 402 → **X_CREDITS_DEPLETED**, return 402 with a truthful detection-specific message; do not suggest reconnect; keep paste-link prominent. |
| **sync-from-x** | PROVIDER_PATH=twitterapi.io; SYNC_PROVIDER_RESULT ok:false, code SPACE_NOT_FOUND, status 404 | sync-from-x correctly uses twitterapi.io. For the tested Space ID the provider returned 404 (not found). **Fix:** Keep provider as-is; ensure 404 SPACE_NOT_FOUND returns a **truthful, provider-specific** message (not temporary outage). No fallback to X API. |

### 2. Detect vs manual paste-link

- **Recommendation:** Keep detect-my-space in the UI as-is (no visual downgrade). **Manual paste-link is the practical primary path** when X API credits are depleted (X_CREDITS_DEPLETED) or when detection returns no match. Paste-link is already prominent; the new copy explicitly directs users to "Paste the Space link below" when detection is unavailable. No UI redesign.

### 3. SPACE_NOT_FOUND audit plan (twitterapi.io)

- **A. URL → space_id:** Audit `parseXSpaceId`: input URL/path → extract id from path `i/spaces/<id>`, id = `[A-Za-z0-9_-]{1,100}`. Confirm no over-trim or wrong regex.
- **B. Request to twitterapi.io:** Audit `fetchSpaceByIdFromTwitterApi`: endpoint `GET https://api.twitterapi.io/twitter/spaces/detail?space_id=<id>`. Confirm query param is `space_id` and value is the extracted id.
- **C/D/E:** Confirm response handling: 404 from provider → SPACE_NOT_FOUND; no double-parsing or wrong field. If all correct, classify as **(E) correct provider 404** for that Space (unavailable/private/deleted on provider side).

### 4. Error-code normalization plan

- **Official X API (x-api-client):** Add **X_CREDITS_DEPLETED**. In `codeFromStatus(status)`: if `status === 402` return `"X_CREDITS_DEPLETED"`. Add to `XApiFailureCode` type.
- **detect-my-space:** When `result.code === "X_CREDITS_DEPLETED"` return 402 and code **X_CREDITS_DEPLETED** with detection-specific message.
- **my-x-spaces:** When `result.code === "X_CREDITS_DEPLETED"` return 402 and code **X_CREDITS_DEPLETED** with truthful message (no linkary fallback for 402).
- **sync-from-x (twitterapi.io path):** Already maps 404 → SPACE_NOT_FOUND. Only change: update **message** to provider-specific not-found copy. No new codes.

### 5. Client copy plan

- **detect-my-space + X_CREDITS_DEPLETED:** Show backend `data.error`: "Automatic X Space detection is temporarily unavailable because the X API credits for this app are depleted. Paste the Space link below." Keep paste-link UI visible.
- **sync-from-x + SPACE_NOT_FOUND:** Show backend `data.error`: "This Space could not be found from the current X data provider. Please check the Space link or try another public/live Space." (Backend will send this; client displays `data.error`.)
- **my-x-spaces + X_CREDITS_DEPLETED:** Show backend `data.error` for 402 (e.g. "X API credits for this app are depleted. Try again later.").

### 6. Risks / compatibility

- Adding a new code **X_CREDITS_DEPLETED** and 402 response: clients that only handle 403/502/429 may show a generic error unless we add explicit handling. We will add handling for 402 + X_CREDITS_DEPLETED in XSpacesPage for detect and my-x-spaces.
- No change to auth, OAuth, or other XSpaces flows.

---

## Post-implementation: audit and deliverables

### SPACE_NOT_FOUND audit (sync-from-x / twitterapi.io)

- **A. URL → space_id:** `parseXSpaceId` in `parseXSpaceId.ts`: path matched with `/^i\/spaces\/([A-Za-z0-9_-]{1,100})/`, id = match[1].trim(). For standard x.com/i/spaces/<id> URLs the extraction is correct. No bug.
- **B. Request to twitterapi.io:** `fetchSpaceByIdFromTwitterApi` calls `GET https://api.twitterapi.io/twitter/spaces/detail?space_id=${encodeURIComponent(id)}`. Query param is **space_id** (matches provider docs). The `id` passed in is the same `spaceId` used in the route (from body.space_id or parseXSpaceId(urlInput)). No bug.
- **C/D. Provider limitation / parsing:** 404 from provider sets res.ok false; codeFromStatus(404) returns SPACE_NOT_FOUND. Response body is not required to determine 404. No wrong normalization or parsing.
- **E. Conclusion:** For the tested Space ID, the provider correctly returned 404 (not found). Classified as **real provider-side not-found** (Space unavailable, private, or deleted on provider). No code fix for extraction or request.

### Files changed

- **apps/web/src/lib/x-api-client.ts** — Added X_CREDITS_DEPLETED to XApiFailureCode; codeFromStatus(402) → X_CREDITS_DEPLETED.
- **apps/web/src/lib/x-analytics-server.ts** — Added X_CREDITS_DEPLETED to FetchXSpaceByIdV2Result code union.
- **apps/web/src/app/api/xspaces/detect-my-space/route.ts** — Handle result.code === "X_CREDITS_DEPLETED": return 402 with detection-specific message.
- **apps/web/src/app/api/spaces/sync-from-x/route.ts** — SPACE_NOT_FOUND (twitterapi.io path) message updated to provider-specific not-found copy.
- **apps/web/src/app/api/xspaces/my-x-spaces/route.ts** — Handle result.code === "X_CREDITS_DEPLETED": return 402 with truthful message (no linkary fallback for 402).
- **apps/web/src/figma/app/components/XSpacesPage.tsx** — Detect: handle 402 / X_CREDITS_DEPLETED with backend message. My-x-spaces: handle 402 / X_CREDITS_DEPLETED with backend message.
- **docs/XSPACES_INCIDENT_CREDITS_AND_404_FIX.md** — Pre-coding plan and post-implementation audit/deliverables.

### Route-by-route diagnosis

| Route | Diagnosis | Fix applied |
|-------|-----------|-------------|
| **detect-my-space** | X API 402 CreditsDepleted → was X_API_FAILED. | 402 → X_CREDITS_DEPLETED; return 402 with "Automatic X Space detection is temporarily unavailable because the X API credits for this app are depleted. Paste the Space link below."; client shows it. |
| **sync-from-x (twitterapi.io)** | 404 SPACE_NOT_FOUND had generic "Space not found." | Message updated to "This Space could not be found from the current X data provider. Please check the Space link or try another public/live Space." Client already uses data.error. |
| **my-x-spaces** | If X returns 402, was generic X_API_FAILED. | 402 → X_CREDITS_DEPLETED; return 402 with "X API credits for this app are depleted. Try again later."; client handles 402 and shows data.error. |

### Bug in sync-from-x URL/provider handling

**None.** Audit confirmed: URL→space_id extraction, twitterapi.io request (endpoint, query param space_id), and 404 handling are correct. SPACE_NOT_FOUND for the tested Space is a **real provider 404** (Space not found on provider side).

### Final error-code mapping

- **Official X API (x-api-client):** 401/403 → X_RECONNECT_NEEDED; 429 → X_RATE_LIMITED; **402 → X_CREDITS_DEPLETED**; 404 → SPACE_NOT_FOUND; else → X_API_FAILED; timeout → X_API_TIMEOUT.
- **sync-from-x (twitterapi.io):** 404 → SPACE_NOT_FOUND (message as above); PROVIDER_TIMEOUT, PROVIDER_* unchanged.
- **detect-my-space / my-x-spaces:** Return 402 + X_CREDITS_DEPLETED when result.code === "X_CREDITS_DEPLETED".

### Client UX mapping

- **detect-my-space + X_CREDITS_DEPLETED:** Show backend error; paste-link remains visible.
- **sync-from-x + SPACE_NOT_FOUND:** Show backend error (provider not-found message).
- **my-x-spaces + X_CREDITS_DEPLETED:** Show backend error (credits depleted).

### Manual QA checklist

- [ ] detect-my-space: when X API returns 402 (or simulate), response is 402 with code X_CREDITS_DEPLETED and message about credits depleted and paste link; UI shows it; paste-link is visible.
- [ ] sync-from-x: with twitterapi.io returning 404, response is 404 SPACE_NOT_FOUND with new provider message; Add from X / paste-link flows show that message (not reconnect, not outage).
- [ ] my-x-spaces: when X returns 402, response is 402 X_CREDITS_DEPLETED; UI shows credits-depleted message.
- [ ] Add from X, session refresh, sync-from-x success path, detect success path, my-x-spaces list (success and linkary fallback), speaker/sponsor/payout/notifications/my-proposals/analytics/reputation/credibility/profile/GET /api/spaces/[id]: unchanged.

### Add from X and unrelated systems

- Add from X session refresh, sync-from-x flow (twitterapi.io and X API path), detect-my-space flow, my-x-spaces flow: only error codes and messages changed; success paths and auth unchanged.
- Speaker applications, sponsor proposals, payout preferences, notifications, my-proposals, analytics, reputation, public credibility, profile/dashboard, GET /api/spaces/[id]: not modified.
