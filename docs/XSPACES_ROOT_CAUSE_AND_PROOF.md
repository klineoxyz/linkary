# XSpaces Sync/Detect — Root Cause and Proof

## 1. Exact root cause summary

- **detect-my-space:** Uses official X API list-by-creator. When X API credits are depleted it returns 402 with no candidates and directs users to paste the Space link. This is correct; twitterapi.io has no list-by-creator endpoint, so there is no reliable alternative for “detect” when credits are depleted.
- **sync-from-x:** Uses twitterapi.io when `TWITTERAPI_IO_KEY` (or `TWITTERAPI_API_KEY`) is set. The code calls **GET /twitter/spaces/detail** with query parameter **space_id** set to the parsed Space ID. Production verification (PROVIDER_VERIFY logs) shows the parsed Space ID matches the pasted URL and is sent correctly. When the provider returns 404, the Space is not found by the provider (unavailable, private, deleted, or not yet indexed) — **not** a Linkary parsing bug.
- **my-x-spaces:** Uses official X API list-by-creator. When that fails (credits depleted, timeout, invalid response, or API failure), the route falls back to the host’s Linkary spaces from the DB and returns them with `spaces_source: "linkary"`. The UI states these are “not a live X list.” This fallback is truthful and does not suggest spaces that would 409 on link; it only lists already-imported Spaces so the user can use the paste flow or re-import. The new log records `fallback_used: true` and `reason: <finalCode>` for observability.
- **Auth (Invalid Refresh Token / Refresh Token Not Found):** Applies to X OAuth token refresh (e.g. my-x-spaces or detect when using the official X API). It does **not** affect sync-from-x when the twitterapi.io path is used, because that path uses the server-side API key only, not the user’s X refresh token. So for sync-by-paste with twitterapi.io, auth refresh errors are unrelated.

## 2. Proof of provider request (correct endpoint and parameter)

- **Endpoint:** We call exactly **GET** `https://api.twitterapi.io/twitter/spaces/detail` (see `TWITTERAPI_BASE` + `endpointPath` in `xspaces-data-provider.ts`).
- **Query parameter:** We send the Space ID as **space_id** (e.g. `?space_id=<parsed_id>`). This matches twitterapi.io’s “Get Space Detail by space id” API.
- **Evidence in logs:** Every provider call now logs a structured line:
  - From **xspaces-data-provider** (`[xspaces-provider]`): `endpoint_path`, `sanitized_query_params: { space_id: "<id>" }`, `provider_status`, `provider_code`, and on success `data_id`, `data_state`, `data_scheduled_start`.
  - From **sync-from-x** (`[sync-from-x] PROVIDER_VERIFY`): `normalized_pasted_url`, `parsed_space_id`, `endpoint_path: "/twitter/spaces/detail"`, `sanitized_query_params: { space_id: "<id>" }`, `provider_status`, `provider_code`, and when ok `data_id`, `data_state`, `data_scheduled_start`; when not ok `provider_message` when available.
- So we can prove in production: (1) the exact endpoint path, (2) the exact query param name and value sent, (3) the parsed Space ID used, and (4) the provider’s HTTP status and our code.

## 3. Classification when provider returns 404

- If logs show **parsed_space_id** equal to the Space ID from the user’s pasted URL and **provider_code: "SPACE_NOT_FOUND"** / **provider_status: 404**, then:
  - The request is correct (endpoint + space_id).
  - The 404 is a **provider coverage/availability** outcome (Space not in provider’s index, deleted, private, or not yet indexed), **not** a Linkary bug.
- If logs ever showed a wrong or empty **parsed_space_id** for a valid paste, that would indicate a parsing/normalization bug in Linkary; no such evidence has been seen.

## 4. twitterapi.io support for Space states

- The provider’s “Space detail” API returns a Space object with fields such as `id`, `title`, `state`, `scheduled_start`. We map these when present.
- When the provider returns **200** with valid `data.id`, we treat the Space as found and sync (subject to host check). When it returns **404** or a body without a valid Space id, we return SPACE_NOT_FOUND.
- We do not have independent evidence of which states (e.g. “scheduled” vs “live” vs “ended”) the provider indexes or when it returns 404; the new logging (including `data_state` and `data_scheduled_start` when present) will allow correlating success/404 with provider response shape and documenting behavior from production evidence.

## 5. Unrelated systems — confirmation

- No changes were made to: auth flow, OAuth flow, analytics, reputation, dashboard, profile, notifications, proposals, payouts, speakers, sponsors, visibility, or other product systems.
- Scope of changes: **xspaces-data-provider** (structured logging only), **sync-from-x** (structured PROVIDER_VERIFY payload only), **my-x-spaces** (structured fallback log only), and this doc. **parseXSpaceId**, **detect-my-space** logic, and all unrelated routes/components are unchanged.

---

## 6. Exact files and changes (surgical scope)

| File | Change |
|------|--------|
| **apps/web/src/lib/xspaces-data-provider.ts** | Introduced `endpointPath` and `sanitizedQueryParams`; added one `[xspaces-provider]` structured log (JSON) at every return path: outbound request shape (`endpoint_path`, `sanitized_query_params`) and provider outcome (`provider_status`, `provider_code`, and when ok `data_id`, `data_state`, `data_scheduled_start`; when not ok `provider_message` where available). No secrets. |
| **apps/web/src/app/api/spaces/sync-from-x/route.ts** | Replaced simple PROVIDER_VERIFY with a single structured payload: `normalized_pasted_url`, `parsed_space_id`, `provider_used`, `endpoint_path`, `sanitized_query_params`, `provider_status`, `provider_code`, `provider_message`, `data_id` / `data_state` / `data_scheduled_start` when ok, `fallback_used: false`. No logic or routing change. |
| **apps/web/src/app/api/xspaces/my-x-spaces/route.ts** | When returning linkary fallback, log one JSON object: `fallback_used: true`, `reason: finalCode`, `spaces_count`. No behavior change. |
| **docs/XSPACES_ROOT_CAUSE_AND_PROOF.md** | This document. |

No other files were modified. No schema, auth, or UI changes outside the above.

## 7. Final behavior summary

- **detect-my-space:** Unchanged. On X API credits depleted returns 402 with no candidates and paste guidance. No fake candidates; no twitterapi.io path (provider has no list-by-creator).
- **my-x-spaces:** Unchanged. On X API failure (including credits depleted) returns host’s Linkary spaces with `spaces_source: "linkary"` when any exist, with new structured log when fallback is used. Otherwise returns 402/502 per existing logic.
- **sync-from-x:** Unchanged. When twitterapi.io is configured, calls GET /twitter/spaces/detail with query param **space_id**; maps provider response and returns existing app-level codes. New structured log proves request and response shape.

## 8. App-level error codes / messages (unchanged)

- **SPACE_NOT_FOUND** (404): “This Space could not be found by the current X data provider. It may be unavailable, private, deleted, or not yet indexed.”
- **X_CREDITS_DEPLETED** (402): detect and my-x-spaces use existing credits-depleted messages.
- **PROVIDER_*** codes:** Existing provider error handling and messages unchanged.
- No new user-facing codes or messages were added.

## 9. Proof that we send the correct provider query parameter

- In **xspaces-data-provider.ts** the request is built as:  
  `GET ${TWITTERAPI_BASE}/twitter/spaces/detail?space_id=${encodeURIComponent(id)}`  
  with `id = String(spaceId ?? "").trim()`.
- So the query parameter name is **space_id** and the value is the trimmed Space ID. This is logged in every provider outcome as `sanitized_query_params: { space_id: "<id>" }` and in sync-from-x as `sanitized_query_params: { space_id: spaceId }`. So we can confirm in logs that the correct parameter name and the exact parsed ID are sent.

## 10. Explicit confirmation

- No unrelated product areas were changed. Only the XSpaces detect/sync flow and the minimal shared provider module were touched, and only with additive, safe structured logging and this documentation.
