# XSpaces Reputation + Analytics Foundation — Implementation Plan

## 1. Implementation plan

| Part | Action |
|------|--------|
| **Part 1** | Add migration with two composite indexes on `space_sponsor_proposals` (project_profile_id+status, space_id+status). Idempotent with IF NOT EXISTS. |
| **Part 2** | Compute reputation counts in a single new read-only endpoint (no new tables). Speaker: from `speaker_requests` where requester_profile_id = me. Sponsor: from `space_sponsor_proposals` where project_profile_id = me. Host: from `spaces` (host_profile_id = me) and `space_sponsor_proposals` on those space_ids. Rates only when denominator > 0. |
| **Part 3** | New route GET /api/xspaces/analytics (auth required). Return shape: host { hosted_spaces, sponsor_proposals_received, sponsor_proposals_accepted }, speaker { applications, approved }, project { proposals_sent, proposals_accepted, proposals_pending }. Optional accepted_sponsorship_volume (sum of offer_amount where status = accepted) when data exists. |
| **Part 4** | Use only: spaces, speaker_requests, space_sponsor_proposals, profiles. No schema changes to these tables. No changes to accept/decline flows. |
| **Part 5** | Replace "Analytics coming soon" in HomeView with a small summary block. When tab === "analytics", fetch GET /api/xspaces/analytics (from parent or in child with token from parent). Display: Hosted Spaces, Speaker Approval Rate, Sponsor Proposals Accepted, Sponsor Acceptance Rate. Reuse StatCard or similar. |
| **Part 6** | Analytics response contains only aggregated numbers. No wallet_address, message, pitch, requested_deliverables, or PII of other users. |
| **Part 7** | No edits to Add from X, profile/dashboard real data, notifications, payout preferences, GET /api/spaces/[id], or sponsor PATCH. New file for analytics route; minimal edits to HomeView + XSpacesPage for loading and passing data. |

---

## 2. Reputation formulas

- **Speaker (requester_profile_id = me)**  
  - applications_total = COUNT(*)  
  - approved_total = COUNT(*) WHERE status = 'approved'  
  - declined_total = COUNT(*) WHERE status = 'declined'  
  - withdrawn_total = COUNT(*) WHERE status = 'withdrawn'  
  - approval_rate = approved_total / (approved_total + declined_total) when (approved_total + declined_total) > 0; else omit.

- **Sponsor / project (project_profile_id = me)**  
  - proposals_total = COUNT(*)  
  - proposals_accepted = COUNT(*) WHERE status = 'accepted'  
  - proposals_declined = COUNT(*) WHERE status = 'declined'  
  - proposals_pending = COUNT(*) WHERE status = 'pending'  
  - acceptance_rate = proposals_accepted / (proposals_accepted + proposals_declined) when denominator > 0; else omit.

- **Host (host_profile_id = me)**  
  - hosted_spaces_total = COUNT(*) FROM spaces  
  - sponsor_proposals_received = COUNT(*) FROM space_sponsor_proposals WHERE space_id IN (my space ids)  
  - sponsor_proposals_accepted = COUNT(*) WHERE status = 'accepted' (same filter)  
  - sponsor_proposals_declined = COUNT(*) WHERE status = 'declined' (same filter)  
  - acceptance_rate = accepted / (accepted + declined) when denominator > 0; else omit.

- **accepted_sponsorship_volume**  
  - SUM(offer_amount) FROM space_sponsor_proposals WHERE project_profile_id = me AND status = 'accepted'.  
  - Return only when > 0 or when we have at least one accepted proposal (so we can return 0). Omit if no accepted proposals.

---

## 3. Analytics endpoint design

**GET /api/xspaces/analytics**

- **Auth:** Required (Bearer token). 401 if missing/invalid.
- **Response:**
```json
{
  "host": {
    "hosted_spaces": number,
    "sponsor_proposals_received": number,
    "sponsor_proposals_accepted": number,
    "sponsor_proposals_declined": number,
    "sponsor_acceptance_rate": number | null
  },
  "speaker": {
    "applications": number,
    "approved": number,
    "declined": number,
    "withdrawn": number,
    "approval_rate": number | null
  },
  "project": {
    "proposals_sent": number,
    "proposals_accepted": number,
    "proposals_declined": number,
    "proposals_pending": number,
    "acceptance_rate": number | null
  },
  "accepted_sponsorship_volume": number | null
}
```
- All counts from existing tables; no sensitive fields. Rates only when denominator > 0.

---

## 4. Index migration plan

- **File:** One new migration, e.g. `20260312000000_xspaces_analytics_indexes.sql`.
- **Indexes:**
  - `idx_space_sponsor_proposals_project_status` ON space_sponsor_proposals(project_profile_id, status)
  - `idx_space_sponsor_proposals_space_status` ON space_sponsor_proposals(space_id, status)
- **Safety:** CREATE INDEX IF NOT EXISTS for both. No table or column changes. Idempotent.

---

## 5. UI placement proposal

- **Where:** XSpaces Home → existing "Analytics" tab (currently "Analytics coming soon").
- **What:** Replace placeholder with a compact block: 4 metrics (Hosted Spaces, Speaker Approval Rate, Sponsor Proposals Accepted, Sponsor Acceptance Rate). Use existing card/stat components if available.
- **Data:** XSpacesPage fetches GET /api/xspaces/analytics when me and mainNav === "home" (or when Analytics tab is first shown). Pass result into HomeView as optional prop; HomeView renders the summary when tab === "analytics". Loader abortable; array-safe; no sensitive data in UI.

---

## 6. Compatibility risks

| Risk | Mitigation |
|------|------------|
| New indexes might slow writes slightly | Composite indexes are standard; impact negligible. |
| Analytics fetch on Home could race with nav | Use AbortController; ignore results when mainNav !== "home" or tab !== "analytics". |
| HomeView contract change | Add optional prop only; existing behavior unchanged when prop is null/undefined. |
| Rate calculations | Only return rate when denominator > 0 to avoid division by zero or misleading 0/0. |

No changes to Add from X, visibility, notifications, payout, or sponsor workflow.
