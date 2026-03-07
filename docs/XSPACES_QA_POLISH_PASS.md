# XSpaces QA / Polish Pass: Fallback Behavior Correct, Safe, Not Misleading

## Pre-coding audit

### 1. What is correct already

- **Detect fallback:** `candidates_source: "linkary"` is always set when fallback candidates are returned (line 301). Candidate shape matches client: `id` (x_space_id), `title`, `state`, `created_at`, `scheduled_start`, `score`; client uses `c.id` for link-space and displays title/scheduled_start. Linkary space (current) is excluded from candidates (`r.id !== linkarySpaceId`).
- **Selection flow:** Client sends `space_id` (createJustDoneSpaceId) and `x_space_id` (c.id) to link-space; backend expects both. Linked state updates via `updateSpaceLinkState` and `clearCreateAndRefresh`. No client/server assumption that candidates came from live X; `detectCandidatesSource` only changes label.
- **my-x-spaces 402:** Client uses `data.error` for 402 X_CREDITS_DEPLETED (no reconnect wording). Reconnect wording only for 403 (X_NOT_CONNECTED etc.).
- **sync-from-x 404:** Provider path returns "This Space could not be found from the current X data provider..."; X API path returns "Space not found on X." Client uses `data.error`; no "temporary outage" for 404.
- **Detect 402:** Client uses `data.error`; backend message mentions credits depleted and paste link.

### 2. Real risk of false-match or misleading UX

- **False matches:** MIN_TITLE_SIMILARITY 0.3 allows a single word match in a 3-word title (e.g. "Weekly Update" vs "Weekly Sales Call"). Slight risk of obviously wrong spaces. **Tweak:** Use a stricter threshold for the linkary fallback only (0.4) so at least ~2/5 or 2/3 of words need to match.
- **Linkary candidates = other spaces’ x_space_ids:** Selecting one often triggers 409 X_SPACE_ALREADY_CLAIMED (that X Space is already linked to another row). Client currently shows `data.error` ("This X Space is already linked to another Linkary space."). **Tweak:** Add explicit branch for `X_SPACE_ALREADY_CLAIMED` with paste guidance so the message is consistent.

### 3. Tiny threshold / copy tweak needed

- **Detect fallback threshold:** Introduce `LINKARY_FALLBACK_MIN_SIMILARITY = 0.4` and use it only in the X_CREDITS_DEPLETED linkary block (keep MIN_TITLE_SIMILARITY 0.3 for the X API scoring path).
- **Detect 402 message:** Remove "temporarily unavailable" to avoid sounding like an outage. Backend: "X API credits for this app are depleted. Paste the Space link below." Client fallback string (when data.error missing): same.
- **Selection 409:** In `handleSelectDetectCandidate`, when `data.code === "X_SPACE_ALREADY_CLAIMED"`, show: "That X Space is already linked to another Space. Paste your new Space link below."
- **Microcopy:** No structural change. Ensure 404 never says "temporary outage" and credits never say "reconnect" (already true). Optionally tighten my-x-spaces fallback to "Showing your Linkary spaces (not a live X list)." if we want one short line; current longer line is also truthful.

### 4. Risks / compatibility notes

- Raising linkary fallback threshold to 0.4 may return fewer candidates in edge cases (e.g. very short titles); 0.4 is still permissive. X API path unchanged (still 0.3). No breaking change to response shape or client contract.

---

## Post-implementation deliverables

### 1. Files changed

- **apps/web/src/app/api/xspaces/detect-my-space/route.ts** — Added `LINKARY_FALLBACK_MIN_SIMILARITY = 0.4`; linkary fallback filter uses it (X API path still uses 0.3). 402 message: "X API credits for this app are depleted. Paste the Space link below."
- **apps/web/src/figma/app/components/XSpacesPage.tsx** — Detect 402 fallback copy updated to same credits message (no "temporarily unavailable"). `handleSelectDetectCandidate`: explicit branch for 409 `X_SPACE_ALREADY_CLAIMED` with "That X Space is already linked to another Space. Paste your new Space link below."
- **docs/XSPACES_QA_POLISH_PASS.md** — Pre-coding audit and post-implementation deliverables.

### 2. Detect fallback QA result

- **Threshold:** Linkary fallback uses 0.4 (stricter than X API 0.3); reduces single-word matches.
- **Wrong spaces:** Excluded current space (`r.id !== linkarySpaceId`); only host’s linked spaces; score = title similarity + 0.2 if scheduled within 2h.
- **scheduled_at:** Helps when both linkary and candidate have times within 2h; bonus 0.2.
- **Candidate shape:** `id` (x_space_id), `title`, `state`, `created_at`, `scheduled_start`, `score` — matches client and link-space (`x_space_id`).
- **candidates_source:** Always `"linkary"` when fallback candidates returned.

### 3. Selection flow QA result

- **candidate id:** Valid x_space_id from host’s linked spaces; link-space accepts it.
- **link-space:** Receives `space_id` (createJustDoneSpaceId) and `x_space_id` (c.id); backend validates host and updates row.
- **Linked state:** `updateSpaceLinkState` + `clearCreateAndRefresh` called on success.
- **Live X assumption:** None; client only uses `detectCandidatesSource` for label ("From your Linkary spaces (X detection unavailable)").
- **409 X_SPACE_ALREADY_CLAIMED:** Handled explicitly with paste guidance when user selects a candidate that is already linked to another Space.

### 4. Error / empty state mapping summary

| Case | Backend | UI message | Truthful |
|------|---------|------------|----------|
| detect 402, no local candidates | 402, code X_CREDITS_DEPLETED, error | data.error: "X API credits... Paste the Space link below." | Yes; no reconnect, no outage |
| detect returns linkary candidates | 200, candidates, candidates_source: "linkary" | "From your Linkary spaces (X detection unavailable). Pick the one that matches:" | Yes; not live X |
| my-x-spaces linkary fallback | 200, spaces, spaces_source: "linkary" | "Showing your Linkary spaces (not a live X list — X API credits or list unavailable)." | Yes |
| my-x-spaces 402, no fallback | 402, X_CREDITS_DEPLETED | data.error (credits depleted) | Yes; no reconnect |
| sync-from-x 404 (provider) | 404, SPACE_NOT_FOUND | data.error (provider message: check link / try another Space) | Yes; no temporary outage |

### 5. Copy changes made

- **Detect 402 (backend + client fallback):** "Automatic X Space detection is temporarily unavailable because the X API credits for this app are depleted. Paste the Space link below." → "X API credits for this app are depleted. Paste the Space link below."
- **Selection 409 X_SPACE_ALREADY_CLAIMED:** Use data.error when present; else "That X Space is already linked to another Space. Paste your new Space link below."
- No change to Create modal step labels, Add from X intro, detect linkary label, my-x-spaces label, or sync-from-x 404 (already truthful).

### 6. Manual QA checklist

- [ ] Detect: 402 with no linkary match → message "X API credits... Paste the Space link below." (no "temporarily unavailable", no "reconnect").
- [ ] Detect: 402 with linkary candidates → list shows "From your Linkary spaces (X detection unavailable). Pick the one that matches:"; select one → link succeeds or 409 with "That X Space is already linked... Paste your new Space link below."
- [ ] my-x-spaces: 402 with no spaces → credits message; 402 with spaces → linkary list + "not a live X list".
- [ ] sync-from-x: 404 SPACE_NOT_FOUND → provider message (check link / try another Space); no "temporary outage".
- [ ] Create modal: paste primary, detect secondary; all messages use backend where applicable.

### 7. Unrelated systems not broken

- Auth, OAuth, sync-from-x, my-x-spaces, link-space, speaker/sponsor/payout/notifications/my-proposals/analytics/reputation/profile/dashboard and GET /api/spaces/[id] unchanged. Only detect-my-space (linkary threshold + 402 message) and XSpacesPage (402 fallback copy + 409 X_SPACE_ALREADY_CLAIMED branch) were modified.
