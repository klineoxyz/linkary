# XSpaces Incident: Detect 409 + Sync 404 — Root Cause and Fix Plan

## Pre-coding

### 1. Exact root cause of 409 after detect fallback

- **What happens:** detect-my-space returns 200 with `candidates_source: "linkary"` and a list of candidates. Each candidate has `id: row.x_space_id` — i.e. the X Space ID of *another* Linkary space (another row in `spaces`). The user is trying to link the *new* space (`createJustDoneSpaceId`) to an X Space. So we're suggesting: "link your new space to this x_space_id." But that `x_space_id` is already stored on a different row (the "other" space we used for similarity). So when the user selects it, link-space correctly returns **409 X_SPACE_ALREADY_CLAIMED** because one X Space can only be linked to one Linkary space.
- **Why already-claimed candidates are included:** The fallback was designed to suggest "similar" host spaces by title/scheduled_at. Every such space is another row with its own `x_space_id`. So every suggested candidate is by definition an x_space_id that is *already linked* to that other row. There are no "unclaimed" x_space_ids in the candidate set. So **all** linkary fallback candidates are unusable for the create/link flow.
- **Conclusion:** For this flow we must not suggest any of these as selectable candidates. The only safe fix is to **stop returning linkary fallback candidates** when X_CREDITS_DEPLETED and always return 402 with paste-link guidance.

### 2. Exact classification of sync-from-x 404

- **URL parsing:** `parseXSpaceId` supports `x.com` and `twitter.com` (and www), path `i/spaces/<id>`, id `[A-Za-z0-9_-]{1,100}`, trailing slash and query params stripped. Same `spaceId` is passed to sync-from-x and then to `fetchSpaceByIdFromTwitterApi(spaceId)`. No truncation or wrong casing.
- **Provider request:** `GET https://api.twitterapi.io/twitter/spaces/detail?space_id=${encodeURIComponent(id)}`. Parameter name and path match twitterapi.io docs. No malformed id in the request.
- **Classification:** **A. Real provider 404** — The provider (twitterapi.io) returns HTTP 404 for the given Space ID. Possible reasons: Space deleted/private, not in provider's index, or provider limitation. No parsing or normalization bug found; request is correct.
- **Action:** Keep provider path. Sharpen the 404 message so the user gets a clear, provider-specific message (no "temporary outage" wording).

### 3. Smallest safe backend fix plan

1. **detect-my-space:** On `result.code === "X_CREDITS_DEPLETED"`, remove the entire block that builds linkary candidates and returns 200. Always return 402 with `{ error: "X API credits for this app are depleted. Paste the Space link below.", code: "X_CREDITS_DEPLETED" }`. No new flags; preserve 402 response shape.
2. **sync-from-x:** When provider returns SPACE_NOT_FOUND (404), keep status 404 and code. Change error message to: "This Space could not be found by the current X data provider. Check the link or paste the direct Space URL (x.com/i/spaces/...)." No change to routing or parsing.

### 4. Smallest safe client/UX correction plan

1. **Detect returns no usable candidates:** Already the case after backend change — we only return 402 with paste message; client already shows `data.error` and paste input is step 1. No client change required.
2. **sync-from-x SPACE_NOT_FOUND:** Client already uses `data.error` for 404 + SPACE_NOT_FOUND. Backend message change is enough; no client copy change unless we want a fallback string — current fallback "Space not found on X." is replaced by backend message.
3. **User selects already-claimed candidate:** Will no longer occur because we no longer return linkary candidates. No UI change.

### 5. Risks / compatibility notes

- **detect:** Removing linkary fallback means on 402 we never show a candidate list; users always see paste guidance. No breaking change to response shape for 402 (still 402 + error). Success path (X API returns data) unchanged.
- **sync-from-x:** Message-only change; no behavior or routing change. Add from X session refresh, provider routing, and all other flows unchanged.

---

## Post-implementation deliverables

### 1. Files changed

- **apps/web/src/app/api/xspaces/detect-my-space/route.ts** — Removed local Linkary fallback candidate block when X_CREDITS_DEPLETED. On 402 we now always return paste-link message; no candidates returned. Removed unused `LINKARY_FALLBACK_MIN_SIMILARITY`.
- **apps/web/src/app/api/spaces/sync-from-x/route.ts** — SPACE_NOT_FOUND error message updated to: "This Space could not be found by the current X data provider. Check the link or paste the direct Space URL (x.com/i/spaces/...)."
- **docs/XSPACES_INCIDENT_DETECT_409_AND_SYNC_404.md** — Root cause, classification, fix plan, and deliverables.

### 2. Exact bug fixed for detect fallback

- **Bug:** We were returning as selectable candidates the host’s other Linkary spaces (each with its own `x_space_id`). Selecting one called link-space with that `x_space_id`, which is already linked to another row → 409 X_SPACE_ALREADY_CLAIMED. Every linkary fallback candidate was therefore unusable.
- **Fix:** Do not return any linkary fallback candidates when X_CREDITS_DEPLETED. Always return 402 with "X API credits for this app are depleted. Paste the Space link below." so the user is guided to the paste flow only.

### 3. Exact classification and fix for sync-from-x 404

- **Classification:** Real provider 404. URL parsing (`parseXSpaceId`) and provider request (`GET .../twitter/spaces/detail?space_id=<id>`) were verified; parameter name and path are correct; no parsing or normalization bug found. twitterapi.io returns HTTP 404 for the given Space ID (e.g. Space not in provider index, deleted, or provider limitation).
- **Fix:** Message-only. Sharper, truthful copy: "This Space could not be found by the current X data provider. Check the link or paste the direct Space URL (x.com/i/spaces/...)." No "temporary outage" wording; provider path and routing unchanged.

### 4. Final route behavior

- **detect-my-space:** On X API credits depleted (402), response is always 402 with `error` + `code: "X_CREDITS_DEPLETED"`. No candidates. Success path (X API returns data) and other error paths unchanged.
- **link-space:** Unchanged. No longer receives selection from detect fallback candidates (none returned).
- **sync-from-x:** Provider path unchanged; 404 SPACE_NOT_FOUND returns new error message. Parsing and `space_id` request unchanged.

### 5. Final UX behavior

- **Detect when credits depleted:** User sees "X API credits for this app are depleted. Paste the Space link below." and the paste input (step 1). No candidate list; no 409 from selecting a fallback candidate.
- **Paste flow / sync-from-x 404:** User sees backend message: "This Space could not be found by the current X data provider. Check the link or paste the direct Space URL (x.com/i/spaces/...)." Client already uses `data.error` for 404 + SPACE_NOT_FOUND.

### 6. Manual QA checklist

- [ ] detect-my-space with credits depleted → 402 only; no candidates; UI shows paste guidance.
- [ ] Paste link → sync-from-x; valid Space → success. Invalid/unknown Space → 404 with new provider message.
- [ ] Add from X: paste URL and "Past X Spaces" list unchanged; session refresh and provider routing unchanged.
- [ ] link-space not called with a detect fallback selection (no such candidates).
- [ ] my-x-spaces, speaker/sponsor/payout/notifications/my-proposals/analytics/reputation/profile/dashboard and GET /api/spaces/[id] unchanged.

### 7. Add from X and unrelated systems not broken

- Add from X session refresh fix, sync-from-x provider routing, detect-my-space credits handling (402 response), speaker applications, sponsor proposals, payout preferences, notifications, my-proposals, analytics, reputation, public credibility, profile/dashboard real-data behavior, and GET /api/spaces/[id] visibility rules were not modified. Only detect-my-space (remove linkary fallback return on 402) and sync-from-x (404 message text) were changed.

---

## Final production QA polish pass

### Files changed (QA pass only)

- **apps/web/src/figma/app/components/XSpacesPage.tsx** — Added URL-format helper under both paste fields: "Use a direct Space URL like x.com/i/spaces/ABC123" (Create modal link-to-X step; Add from X modal).
- **docs/XSPACES_INCIDENT_DETECT_409_AND_SYNC_404.md** — This QA section.

### Verification (no bugs found)

1. **detect-my-space on X_CREDITS_DEPLETED** — Route returns only 402 with `error` + `code: "X_CREDITS_DEPLETED"`; no candidates block. Confirmed.
2. **link-space not reachable from detect on credits-depleted** — link-space is only called when user selects a candidate (handleSelectDetectCandidate). Since 402 path returns no candidates, no list is shown and user cannot select; link-space is not reachable from that flow. Confirmed.
3. **sync-from-x 404 from backend data.error** — All three UI entry points use backend message when present:
   - Create modal paste (Link pasted URL): `res.status === 404 && data.code === "SPACE_NOT_FOUND" ? (data.error ?? "Space not found on X.")` — uses data.error.
   - Add from X list item (Import): `r.status === 404 && d.code === "SPACE_NOT_FOUND" ? (d.error ?? "Space not found on X.")` — uses d.error.
   - Add from X paste submit: `res.status === 404 && data.code === "SPACE_NOT_FOUND" ? (data.error ?? "Space not found on X.")` — uses data.error.
   No change made; backend sends error and client displays it.

### Final QA checklist

- [ ] detect-my-space with X API credits depleted → 402 only; response has no `candidates`; UI shows paste guidance and no candidate list.
- [ ] No way to trigger link-space from detect when credits depleted (no candidates to select).
- [ ] Create modal: paste field has helper "Use a direct Space URL like x.com/i/spaces/ABC123"; sync-from-x 404 shows backend data.error.
- [ ] Add from X modal: paste field has same helper; 404 from paste or from list-item Import shows backend data.error.
- [ ] Auth, OAuth, analytics, reputation, speakers, sponsors, payouts, notifications, profile, visibility untouched.

### Confirmation: no unrelated systems changed

- Backend logic unchanged in this QA pass. Only client: added two lines of helper copy under the paste inputs. Auth, OAuth, analytics, reputation, speakers, sponsors, payouts, notifications, profile, visibility rules not touched.

---

## Final release-readiness pass

### Files changed

- **apps/web/src/app/api/xspaces/detect-my-space/route.ts** — Added debug breadcrumb: `console.warn("[xspaces] detect_credits_depleted")` when returning 402 X_CREDITS_DEPLETED.
- **apps/web/src/app/api/spaces/sync-from-x/route.ts** — Added debug breadcrumb: `console.warn("[xspaces] sync_space_not_found")` when returning 404 SPACE_NOT_FOUND (provider path and X API path).
- **docs/XSPACES_INCIDENT_DETECT_409_AND_SYNC_404.md** — This release-readiness section.

### Verification (no code logic change)

1. **Helper text** — Present under both paste fields (Create modal line ~1361, Add from X modal line ~1512): "Use a direct Space URL like x.com/i/spaces/ABC123".
2. **detect-my-space on X_CREDITS_DEPLETED** — Returns only 402 with `error` + `code: "X_CREDITS_DEPLETED"`; no `candidates` in response. Confirmed.
3. **sync-from-x SPACE_NOT_FOUND** — All three UI entry points use backend `data.error` / `d.error`: Create modal paste (1380), Add from X list Import (1555), Add from X paste submit (1630). Confirmed.

### Anything still failing

- None. Breadcrumbs are additive only; no behavior change.

### Final release checklist

- [ ] Helper "Use a direct Space URL like x.com/i/spaces/ABC123" visible under both paste fields in production.
- [ ] detect-my-space with credits depleted → 402 only; no candidates; UI shows paste guidance; logs show `[xspaces] detect_credits_depleted` when applicable.
- [ ] sync-from-x 404 → backend message shown in all three entry points; logs show `[xspaces] sync_space_not_found` when applicable.
- [ ] No change to backend/provider/auth logic beyond adding console.warn breadcrumbs.
- [ ] Unrelated systems (auth, OAuth, analytics, reputation, speakers, sponsors, payouts, notifications, profile, visibility) not touched.

### Confirmation: ready for production

- Only changes: two server-side `console.warn` breadcrumbs for user-reported failure correlation (`detect_credits_depleted`, `sync_space_not_found`). No backend/provider/auth logic change. Unrelated systems unchanged. Release-ready.
