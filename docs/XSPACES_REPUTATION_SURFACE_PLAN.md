# XSpaces Reputation Surface + Credibility — Implementation Plan

## 1. Short implementation plan

| Part | Action |
|------|--------|
| **Part 1** | New GET /api/xspaces/reputation. Auth required. Reuse data from existing /api/xspaces/analytics (internal server-side fetch with same token). Add one extra read-only query: count approved speaker_requests on spaces I host. Return shape: speaker (applications_total, approved_total, declined_total, withdrawn_total, approval_rate), sponsor (proposals_total, accepted_total, declined_total, pending_total, acceptance_rate), host (hosted_spaces_total, sponsor_proposals_received, sponsor_proposals_accepted, sponsor_proposals_declined, sponsor_acceptance_rate, **approved_speakers_total**). |
| **Part 2** | Extend Analytics tab: add a small "Reputation" block below the existing 4 analytics cards. Show: Speaker Approval Rate, Sponsor Acceptance Rate, Hosted Spaces, Approved Speakers Hosted. Fetch GET /api/xspaces/reputation when mainNav === "home" and me?.id (in parallel with analytics). Pass reputation into HomeView; render compact row/section when tab === "analytics". |
| **Part 3** | No public API or profile changes. Add a short note in deliverables: future public credibility can expose the same aggregates (e.g. hosted_spaces_total, sponsor_proposals_accepted, approved_speakers_total) via a dedicated public-safe endpoint or profile field when product is ready. |
| **Part 4** | No changes to analytics route, Add from X, sponsor flow, payout, notifications, profile/dashboard, or visibility. AbortController for reputation fetch; sanitized error handling. |

---

## 2. Reputation formulas

Same as analytics (see XSPACES_REPUTATION_ANALYTICS_PLAN.md):

- **Speaker:** applications_total, approved_total, declined_total, withdrawn_total; approval_rate = approved / (approved + declined) when denominator > 0.
- **Sponsor:** proposals_total, accepted_total, declined_total, pending_total; acceptance_rate = accepted / (accepted + declined) when denominator > 0.
- **Host:** hosted_spaces_total, sponsor_proposals_received, sponsor_proposals_accepted, sponsor_proposals_declined, sponsor_acceptance_rate; **plus** approved_speakers_total = COUNT(*) FROM speaker_requests WHERE status = 'approved' AND space_id IN (my space ids).

No fake score; no hidden weighting; counts and rates only.

---

## 3. API design

**GET /api/xspaces/reputation**

- **Auth:** Required (Bearer). 401 if missing/invalid.
- **Data source:** Internal call to GET /api/xspaces/analytics (same token) + one Supabase query for approved_speakers_total on host’s spaces.
- **Response:**
```json
{
  "speaker": {
    "applications_total": number,
    "approved_total": number,
    "declined_total": number,
    "withdrawn_total": number,
    "approval_rate": number | null
  },
  "sponsor": {
    "proposals_total": number,
    "accepted_total": number,
    "declined_total": number,
    "pending_total": number,
    "acceptance_rate": number | null
  },
  "host": {
    "hosted_spaces_total": number,
    "sponsor_proposals_received": number,
    "sponsor_proposals_accepted": number,
    "sponsor_proposals_declined": number,
    "sponsor_acceptance_rate": number | null,
    "approved_speakers_total": number
  }
}
```

---

## 4. UI placement

- **Where:** XSpaces Home → Analytics tab, **below** the existing 4 StatCards.
- **What:** One compact "Reputation" subsection: heading + 4 metrics (Speaker Approval Rate, Sponsor Acceptance Rate, Hosted Spaces, Approved Speakers Hosted). Reuse StatCard or a compact row; same token-based loading as analytics.
- **Data:** XSpacesPage fetches GET /api/xspaces/reputation when mainNav === "home" and me?.id (in parallel with analytics). Pass reputation to HomeView; show block only when tab === "analytics" and reputation data is available (or show "—" / loading).

---

## 5. Risks / compatibility notes

| Risk | Mitigation |
|------|------------|
| Reputation endpoint depends on analytics | Internal fetch uses same request token; if analytics is down, reputation returns 401/5xx and UI shows unavailable. |
| Extra fetch on Home | Single parallel request; abortable when leaving home. |
| approved_speakers_total query | Read-only; uses existing indexes (space_id, status on speaker_requests if any); otherwise small table scan on host’s spaces. |
| Public credibility (Part 3) | Not implemented; no changes to profile or public APIs. Recommendation for later: add optional public-safe fields or GET /api/profiles/[id]/xspaces-reputation (aggregates only) when product is ready. |

No changes to Add from X, analytics endpoint, profile/dashboard real-data, or sponsor workflow.
