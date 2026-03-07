# XSpaces Final Product Pass: Reduce X API Dependence in Practice

## Pre-coding

### 1. What is already correct

- sync-from-x uses twitterapi.io when key set; 404 SPACE_NOT_FOUND has provider-specific message.
- detect-my-space maps 402 → X_CREDITS_DEPLETED with paste-link message.
- my-x-spaces has linkary fallback for X_API_TIMEOUT / INVALID_X_RESPONSE / X_API_FAILED; shows "Showing your Linkary spaces (X list temporarily unavailable)."
- Client uses data.error for sync-from-x and detect errors. No reconnect-X for credits.

### 2. What still depends on official X API

- **detect-my-space:** List-by-creator (GET /2/spaces/by/creator_ids). Fails with 402 when credits depleted.
- **my-x-spaces:** Same list-by-creator. Fails with 402 when credits depleted; currently returns 402 without trying linkary fallback.

### 3. Is local Linkary fallback for detect safe?

- **Yes.** When X returns 402, before returning 402 we can: (1) load the Linkary space (linkarySpaceId) to get title/scheduled_at; (2) query host’s spaces where x_space_id is not null; (3) score by title similarity (existing tokenize/titleSimilarity) and optional scheduled_at proximity; (4) if any score ≥ 0.3, return 200 with candidates in the same shape as X candidates, plus candidates_source: "linkary". Client already handles require_selection + candidates; we add handling for candidates_source so copy is truthful ("From your Linkary spaces (X detection unavailable)"). No new infra; reuses existing scoring pattern; explicit in code as local fallback.

### 4. Minimal UX adjustment plan

- **Create modal (after Space created):** Reorder so paste-link is first: "1. Paste your X Space link (recommended)" with input + "Link pasted URL" button. Then "2. Or try automatic detection" with Detect button. Helper: "Paste the link for reliable import. Detection may be unavailable when X API credits are limited."
- **Add from X modal:** Already paste-first (URL input at top). Optionally add one line: "Paste a Space link to import (most reliable)." No structural change.
- **When detect returns X_CREDITS_DEPLETED:** Keep current message; paste input is already below; ensure section label makes paste the primary (done by reorder above).
- **my-x-spaces when showing linkary fallback:** Keep/use explicit "Showing your Linkary spaces (X list unavailable)." When fallback is due to 402, same message or "X API credits depleted. Showing your Linkary spaces instead." (Backend will return fallback for 402; client can show same or slightly different copy.)

### 5. Risks / compatibility

- Detect local fallback returns 200 with candidates_source: "linkary". Client must not treat these as live X Spaces; link-space with selected id still works (id is x_space_id). Low risk.
- my-x-spaces: adding 402 to fallback branch changes no response shape (same spaces_source: "linkary").
- Reordering Create modal is copy/layout only; no API or auth change.

---

## Post-implementation deliverables

### 1. Files changed

- **apps/web/src/app/api/xspaces/my-x-spaces/route.ts** — X_CREDITS_DEPLETED added to linkary fallback branch; return 402 only when no fallback rows.
- **apps/web/src/app/api/xspaces/detect-my-space/route.ts** — Local Linkary fallback on X_CREDITS_DEPLETED: load linkary space title/scheduled_at, query host’s linked spaces, score by title similarity + optional scheduled_at proximity; return 200 with candidates + candidates_source: "linkary" when confidence ≥ 0.3; else 402 with paste-link message. Comments state fallback is local only, not live X.
- **apps/web/src/figma/app/components/XSpacesPage.tsx** — Create modal: paste-link is step 1 (recommended), detect is step 2; added detectCandidatesSource state and "From your Linkary spaces (X detection unavailable)" when candidates_source === "linkary"; Add from X copy updated to "Paste a Space link to import (most reliable)"; my-x-spaces fallback message: "Showing your Linkary spaces (not a live X list — X API credits or list unavailable)."
- **docs/XSPACES_FINAL_PRODUCT_PASS.md** — Pre-coding rationale and post-implementation deliverables.

### 2. Product behavior after the change

- **Create flow (after Space created):** User sees "1. Paste your X Space link (recommended)" first with input and "Link pasted URL"; "2. Or try automatic detection" with Detect button. If detect returns 402 and no local fallback candidates, message directs to paste link (paste input is above). If detect returns local fallback candidates, UI shows "From your Linkary spaces (X detection unavailable). Pick the one that matches" and selection links via link-space.
- **Add from X:** Paste-first copy emphasizes "most reliable"; "Past X Spaces" list shows linkary fallback when 402/timeout/failed with explicit "not a live X list — X API credits or list unavailable."
- **detect-my-space:** On 402, backend tries local Linkary candidate search; if good matches, returns 200 with candidates_source: "linkary"; otherwise 402 with paste-link message.
- **my-x-spaces:** On 402, backend returns host’s Linkary spaces when any exist (spaces_source: "linkary"); 402 only when no fallback rows.

### 3. Detect fallback summary

- Trigger: X API returns credits depleted (402).
- Logic: Load Linkary space (request space_id) title/scheduled_at; query host’s spaces with non-null x_space_id; score by titleSimilarity + optional 2h scheduled_at proximity; keep score ≥ 0.3, top 5.
- Response: 200 with found, require_selection, candidates (same shape as X), candidates_source: "linkary". If no candidates, 402 with existing paste-link message.
- Code explicitly comments: local Linkary data only, not live X lookup.

### 4. my-x-spaces fallback summary

- Trigger: X_CREDITS_DEPLETED (or X_API_TIMEOUT / INVALID_X_RESPONSE / X_API_FAILED).
- Logic: Same as before — query host’s spaces with x_space_id/x_space_url, build linkaryItems.
- Response: 200 with spaces, spaces_source: "linkary" when any rows; 402 only when result.code === "X_CREDITS_DEPLETED" and no linkary rows.

### 5. Client UX mapping summary

| Path | Primary action | When 402 / fallback |
|------|----------------|---------------------|
| Create modal (link to X) | Paste link (step 1) | Detect shows 402 message or linkary candidates with "From your Linkary spaces (X detection unavailable)"; paste input remains primary. |
| Add from X | Paste URL at top | "Past X Spaces" shows linkary list with "not a live X list — X API credits or list unavailable" when fallback. |
| Detect candidates | Same link-space flow | candidates_source: "linkary" only changes label, not behavior. |

### 6. Manual QA checklist

- [ ] Create Space → link to X: paste link first, link pasted URL → success; sync-from-x and link state update.
- [ ] Create Space → link to X: Detect my Space with credits depleted → 402 message or linkary candidates; if candidates, select one → link-space success.
- [ ] Create Space → link to X: Detect my Space with credits OK → X candidates or direct link; behavior unchanged.
- [ ] Add from X: paste URL → import; "Past X Spaces" with 402 → linkary list and message "not a live X list…"; click item → sync-from-x by URL.
- [ ] my-x-spaces: 402 with host spaces → list shows with linkary message; 402 with no spaces → credits-depleted error.
- [ ] No reconnect-X or "temporary outage" wording for credits depletion or provider 404.
- [ ] sync-from-x 404 → SPACE_NOT_FOUND message; detect 402 → paste-link message or linkary candidates.

### 7. Unrelated systems unchanged

- Add from X session refresh, sync-from-x, my-x-spaces, detect-my-space (behavior extended, not replaced), speaker applications, sponsor proposals, payout preferences, notifications, my-proposals, analytics, reputation, public credibility, profile/dashboard real-data behavior, and GET /api/spaces/[id] visibility rules were not modified except as specified above (my-x-spaces 402 fallback, detect local fallback, Create/Add from X copy and ordering). Auth and OAuth flows unchanged.
