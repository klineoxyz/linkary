# XSpaces Credibility — Verification + Polish Plan

## 1. Short implementation plan

| Part | Action |
|------|--------|
| **Part 1** | Verify in code: (1) detect-my-space 502 hardening, deterministic status codes, no token logging, malformed X API guards, rate-limit fallback safety. (2) Analytics and reputation use shared helper only; no internal fetch. (3) Public credibility endpoint exposes only the three aggregates; no sensitive data. (4) Add from X, sponsor workflow, profile/dashboard untouched. |
| **Part 2** | Verify indexes exist and match queries: idx_space_sponsor_proposals_project_status, idx_space_sponsor_proposals_space_status, idx_speaker_requests_space_status. Add migration only if any are missing or wrongly defined; no speculative index bloat. |
| **Part 3** | **Document only** for public credibility UI. Do not add UI in this pass: PublicProfilePage uses demo data and profileId is the viewer’s id; adding a block would require owner profile id and could touch profile contracts. Document next-safe placement. |
| **Part 4** | Optional minimal detect UX polish: clearer safe error copy for 502/503 (e.g. “X or our service is temporarily unavailable. Try again in a moment or paste the link below.”); no flow or auth changes. |
| **Part 5** | No changes to Add from X, profile/dashboard, sponsor/speaker, notifications, payout, visibility, analytics/reputation shapes. |

---

## 2. What is already implemented vs what still needs work

**Already implemented (no redo):**

- Detect-my-space 502 hardening: rate-limit fallback try/catch, outer catch with safe sanitizeServerError, defensive recent/scored filters.
- Shared stats: `xspaces-stats.ts` with `getXSpacesAnalytics` and `getApprovedSpeakersTotal`; analytics and reputation routes use it directly; no endpoint-to-endpoint fetch.
- Public credibility: GET /api/profiles/[id]/xspaces-credibility returns only hosted_spaces_total, approved_speakers_total, sponsor_proposals_accepted; uses service role; no wallet/rates/messages/pitches/deliverables.
- Indexes: idx_space_sponsor_proposals_project_status, idx_space_sponsor_proposals_space_status (20260312000000); idx_speaker_requests_space_status (20260314000000).

**Verification only (this pass):**

- Confirm the above in code; no behavioral changes unless a real bug is found.
- Confirm indexes are present and correctly defined.
- Optionally improve detect 502/503 error copy on the client.

**Document only (no code):**

- Public credibility UI: next-safe placement and integration steps when owner profile id is available.

---

## 3. Public UI decision

- **Decision: document only; do not implement UI in this pass.**
- **Reason:** PublicProfilePage currently uses demo data and passes `profileId` as the logged-in viewer’s id (for wallets). The credibility API requires the **viewed profile’s id** (owner). Introducing owner id and a new block could touch profile routing and data contracts. Safer to document the exact next step.
- **Next-safe UI placement (for later):** When the public profile flow has the **viewed profile’s id** (e.g. from `/api/public/profile?username=...` or route params), add a small “XSpaces” or “Credibility” block in UnifiedProfileLayout (or the section that renders that profile). Fetch GET /api/profiles/{ownerId}/xspaces-credibility (no auth). Display only: Hosted X Spaces, Approved Speakers Hosted, Sponsor Proposals Accepted. Use existing card/badge patterns; no charts or fake data.

---

## 4. Index verification plan

- **Check:** Migrations 20260312000000 and 20260314000000.
- **Expected:**  
  - `idx_space_sponsor_proposals_project_status` ON (project_profile_id, status)  
  - `idx_space_sponsor_proposals_space_status` ON (space_id, status)  
  - `idx_speaker_requests_space_status` ON (space_id, status)
- **Action:** If any index is missing or different, add a single migration with CREATE INDEX IF NOT EXISTS. Do not add further indexes unless a concrete query pattern justifies it (current credibility and analytics paths are already covered).

---

## 5. Risks / compatibility notes

| Risk | Mitigation |
|------|------------|
| Verification touches working code | Verification is read-only; only optional copy change for detect 502/503. |
| Public UI on wrong page | No UI added; placement documented for when owner id is available. |
| Index migration in wrong order | Use IF NOT EXISTS; idempotent. |
| Detect copy change confuses users | Copy is generic and safe (“temporarily unavailable”, “try again or paste link”). |

No changes to Add from X, sync-from-x, detect flow logic, sponsor workflow, profile/dashboard, or auth/OAuth.
