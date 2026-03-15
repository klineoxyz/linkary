# Verified Work Flow — Audit & Deliverables

**Mission:** Audit and complete Linkary’s verified work flow from gigs/jobs/collaborations to reviews and case studies so the trust engine works end-to-end.

---

## 1. Current workflow map

### 1.1 Entities and DB

| Entity | Table | Purpose |
|--------|--------|---------|
| **Jobs** | `jobs` | Org work (type: job \| sprint). status: open \| accepted \| completed \| paid. |
| **Applications** | `applications` | Apply to jobs (applicant profile or org). status: pending \| accepted \| rejected \| withdrawn. |
| **Deals (org)** | `deals` | Org↔profile. Created when org accepts profile application. profile_id, org_id, job_id, application_id. status: active \| completed \| disputed. delivered_at, accepted_at, completed_at (trigger sets completed). |
| **Gigs** | `gigs` | Profile-owned work. owner_profile_id, status: open \| closed \| filled. |
| **Gig applications** | `gig_applications` | Apply to gigs. status: submitted \| accepted \| rejected \| withdrawn. |
| **Gig deals** | `gig_deals` | Created when gig owner accepts application. owner_profile_id, participant_profile_id, status: active \| completed \| cancelled. |
| **Collab requests** | `collab_requests` | Profile→profile request. status: new \| accepted \| archived. **Not** linked to deals or gig_deals. |
| **Reviews** | `reviews` | Either deal_id (org) or gig_deal_id (gig). verified_deal set by trigger. One per deal per reviewer. |
| **Case studies** | `case_studies` | owner_type profile \| org, title, description, proof, is_public. **No** deal_id / gig_deal_id (pre-audit). |

### 1.2 Code paths

| Flow | Trigger | API / lib | Result |
|------|--------|-----------|--------|
| **Org: job → deal** | Org accepts application | POST `/api/applications/[id]/accept` | Inserts `deals` (active), updates application + job status. |
| **Org: complete deal** | Creator marks delivered, org marks accepted | POST `/api/deals/[id]/mark-delivered`, POST `/api/deals/[id]/mark-accepted` | Trigger sets completed_at and status = completed. |
| **Gig: application → deal** | Gig owner accepts | PATCH `/api/gig-applications/[id]/status` body `{ status: "accepted" }` | Inserts `gig_deals` (active). |
| **Gig: complete** | Gig deal owner | POST `/api/deals/[id]/complete` (uses **gig_deals** table) | gig_deal status → completed. |
| **Can review (org)** | — | GET `/api/reviews/can-review?username=` | Completed deals where target is profile and caller is org admin; no existing org review. |
| **Can review (gig)** | — | Same | Gig deals (active or completed) where caller + target are parties; no existing review. |
| **Create review** | — | POST `/api/reviews` | verified_deal: true, deal_id or reviewee_profile_id (gig). DB trigger enforces parties + no self-review. |
| **Case study create** | — | `createCaseStudyForProfile` / `createCaseStudyForOrg` (client + RLS) | No API; no link to deal/gig_deal. |
| **Collab request accepted** | — | POST `/api/collab-requests/update` | status → accepted. **Does not** create gig_deal or deal. |

### 1.3 What is complete, partial, or dead

| Flow | Status | Notes |
|------|--------|--------|
| Org: job → application → accept → deal | **Complete** | Deal created, mark-delivered / mark-accepted → completed. |
| Org: completed deal → review | **Complete** | can-review + POST review; trigger enforces completed + parties. |
| Gig: application → accept → gig_deal | **Complete** | gig_deal created on accept. |
| Gig: gig_deal → complete | **Complete** | POST /api/deals/[id]/complete updates gig_deals. |
| Gig: gig_deal (active or completed) → review | **Complete** | can-review + POST review; trigger enforces parties. |
| Collab request accepted | **Partial** | No verified deal/review path; standalone handshake. |
| Case study from verified work | **Missing** | No deal_id / gig_deal_id on case_studies; no “create from work” entry. |
| Review eligibility in UI | **Partial** | LeaveReviewBlock only shows when canReview; no “not eligible” / “already reviewed” messaging. |
| Jobs / sprints (market) | **Alive** | MarketplacePage, org jobs tab. |
| Creator programs | **Separate** | Different tables; not part of verified-review flow. |

---

## 2. Canonical v1 verified-work flow (chosen)

Single path for v1:

1. **Work opportunity created** — Gig (owner creates) or Job (org creates).
2. **Participant linked** — Gig application accepted → `gig_deals` row; or job application accepted → `deals` row.
3. **Work marked done** — Gig: owner sets gig_deal to completed. Org: creator mark-delivered, org mark-accepted → trigger sets deal completed.
4. **Review unlocked** — can-review returns true for the other party; POST /api/reviews with verified_deal: true.
5. **Optional case study** — From completed deal/gig_deal: create case study with optional link (deal_id or gig_deal_id) so it is proof-backed.

**Out of scope for v1:** Collab request “accept” does not create a deal; no verified review from collab-only flow. No redesign of jobs vs gigs vs creator programs.

---

## 3. Changes made (exact files)

### 3.1 Schema

| File | Change |
|------|--------|
| `supabase/migrations/20260402000001_case_studies_verified_work.sql` | **New.** Add `deal_id`, `gig_deal_id` (nullable FK to deals, gig_deals); indexes. |

### 3.2 API

| File | Change |
|------|--------|
| `apps/web/src/app/api/reviews/can-review/route.ts` | Return `reason: "no_eligible_deal"` \| `"already_reviewed"` when `canReview: false`. |
| `apps/web/src/app/api/case-studies/route.ts` | **New.** POST create case study; optional `deal_id` / `gig_deal_id`; party check; insert with link. |
| `apps/web/src/app/u/[username]/LeaveReviewBlock.tsx` | When `!state.canReview` and `state.reason`, show one line: “You’ve already left a review.” or “Reviews are available after a completed collaboration with this creator.” |

### 3.3 UI

| File | Change |
|------|--------|
| `apps/web/src/figma/app/components/DealDetailPage.tsx` | When deal completed, add button “Create case study from this work →” that sets route to profile with `openCaseStudyFromDeal: deal.id`. |
| `apps/web/src/figma/app/App.tsx` | When `route.data.openCaseStudyFromDeal` set, open case study modal and store `caseStudyFromDealId`; on save when `caseStudyFromDealId` set, POST `/api/case-studies` with `deal_id`; clear on cancel. |

### 3.4 Tests

| File | Change |
|------|--------|
| `apps/web/src/app/api/reviews/can-review/route.test.ts` | Add test for `reason: "no_eligible_deal"` when no deals; add test for `reason: "already_reviewed"` when org deal exists but already reviewed. |
| `apps/web/src/app/api/case-studies/route.test.ts` | **New.** 401 no token; 404 deal not found; 403 caller not party; 201 with deal_id as profile party; 201 without deal_id. |

---

## 4. Schema / status changes

- **case_studies:** two new nullable FKs: `deal_id`, `gig_deal_id`. No change to status or existing columns.
- **deals / gig_deals / reviews:** no schema change. Status flows unchanged.

---

## 5. Tests added/updated

- `apps/web/src/app/api/reviews/can-review/route.test.ts`: add cases for `reason: "already_reviewed"` and `reason: "no_eligible_deal"`.
- `apps/web/src/app/api/case-studies/route.test.ts` (new): POST with deal_id as profile party (201); POST with deal_id not party (403); POST without deal_id (201, no link).

---

## 6. Remaining gaps / deferred

- **Collab request → verified review:** Accepted collab does not create gig_deal; no review path. Deferred: either future “convert to gig deal” or keep collab as non-verified.
- **Gig deal detail page:** Deal detail in app is org-deal only; gig deals listed via /api/deals/mine but no dedicated gig-deal detail page with “Create case study.” Deferred: add gig-deal detail or “Create case study” from a unified “My work” list.
- **Case study create from org deal in UI:** “Create case study from this work” on DealDetailPage can link to profile edit with query param; full modal prefill deferred if not in initial scope.
- **Org case studies linked to deal:** Optional org-owned case study with deal_id (org as party) not implemented; only profile case studies with deal_id/gig_deal_id in this pass.

---

## 7. Regression checklist

- [ ] **Org flow:** Accept application → deal created; mark-delivered + mark-accepted → completed; can-review true for org admin; POST review succeeds.
- [ ] **Gig flow:** Accept application → gig_deal created; complete gig_deal; can-review true for participant; POST review succeeds.
- [ ] **No self-review:** API and DB trigger reject.
- [ ] **No non-party review:** API and DB trigger reject.
- [ ] **Case study link:** POST /api/case-studies with deal_id or gig_deal_id only when caller is party (403 otherwise).
- [ ] **Public profile:** Only proof-backed / approved case studies and verified reviews; no private workflow metadata leaked.
- [ ] **LeaveReviewBlock:** Shows form when canReview; shows “You’ve already left a review” or “Reviews are available after a completed collaboration” when !canReview and reason.
- [ ] **Create case study from deal:** DealDetailPage “Create case study from this work” opens profile and Add Case Study modal; save calls POST with deal_id.
- [ ] **No privacy regression; no fake proof paths.**
- [ ] Run: `pnpm test:route` (includes can-review and case-studies); `pnpm test:profile-analytics`.
