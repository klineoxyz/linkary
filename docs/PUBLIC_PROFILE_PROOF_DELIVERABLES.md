# Public profile proof — audit and improvements

Audit and improvements to how **verified work, reviews, and proof-backed case studies** appear on the **public profile** (`/{username}`) so the trust engine is clearly visible without leaking private workflow details.

---

## 1. Current public-proof audit

### 1.1 Data flow

- **Public profile page:** `apps/web/src/app/(public)/[username]/page.tsx` — resolves entity by username and calls `buildPublicProfilePayloadFromEntity` (server-only).
- **Public API:** `GET /api/public/profile?username=...` — uses same `buildPublicProfilePayloadFromEntity`; response is cached (s-maxage=300, stale-while-revalidate=3600).
- **UI:** `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` renders the payload; case studies use `CaseStudyCard`; reviews use inline cards with optional “Verified” badge.

### 1.2 Pre-improvement state

| Area | Finding |
|------|--------|
| **Reviews** | Reviews were loaded with `verified_deal: true` from DB, but payload did not set `source` ("collab" \| "legacy"). The UI “Verified” badge checks `source === "collab"`, so **no reviews showed as Verified** on the public profile. |
| **Case studies** | Mapped to `{ id, title, summary, tags, url }` only. No indicator that a case study was linked to completed deal/gig_deal; **proof-backed case studies were not distinguishable** from generic content. |
| **Section labels** | Reviews section had no sublabel explaining that reviews come from completed work. |
| **Empty states** | Empty reviews already had a clear message (“Verified reviews appear after completed deals.”). |
| **Privacy** | Public payload did **not** expose `deal_id`, `gig_deal_id`, or other internal IDs; safe. |

### 1.3 Trust signals identified as missing or unclear

- Verified review treatment (badge) not shown because `source` was never set.
- No “from verified work” signal for case studies linked to completed deals.
- No explicit “From completed work” sublabel under the Reviews section when reviews exist.

---

## 2. Exact files changed

| File | Change |
|------|--------|
| **`apps/web/src/lib/buildPublicProfilePayload.ts`** | For reviews from the verified_deal query: set `source: "collab"`. For reviews from `dto.reviews` fallback: set `source: "legacy"`. For case studies: query `case_studies` with `select("id, deal_id, gig_deal_id")` for profile owner; filter in JS where `deal_id != null \|\| gig_deal_id != null` to build a `Set` of case study ids; add `from_verified_work: caseStudyLinkedIds.has(c.id)` to each case study. **No** `deal_id` or `gig_deal_id` returned to client. |
| **`apps/web/src/app/api/public/profile/route.ts`** | Extended `PublicProfileApiPayload` `caseStudies` item type with `from_verified_work?: boolean`. Documented `reviews.latest[].source` as `'collab' \| 'legacy'` for Verified badge. |
| **`apps/web/src/components/public/CaseStudyCard.tsx`** | Added prop `fromVerifiedWork?: boolean`. When true, render “From verified work” badge (same visual style as Verified review badge). |
| **`apps/web/src/app/(public)/[username]/PublicProfileContent.tsx`** | Pass `from_verified_work` into `CaseStudyCard` as `fromVerifiedWork`. Under Reviews section title, when `reviews.count > 0`, show sublabel “From completed work”. |
| **`apps/web/src/lib/buildPublicProfilePayload.test.ts`** | **New.** Unit tests: payload must not contain `deal_id`, `gig_deal_id`, `collab_request_id`, `converted_gig_deal_id` anywhere; proof-backed case study has `from_verified_work`; verified review has `source` "collab" or "legacy". |
| **`apps/web/vitest.config.ts`** | Added `src/lib/**/*.test.ts` to `include` so lib unit tests run with `pnpm test:route`. |

---

## 3. Proof signals improved

| Signal | Implementation |
|-------|----------------|
| **Verified review** | Reviews from the verified_deal path now have `source: "collab"`; UI shows “Verified” badge when `source === "collab"`. Legacy DTO reviews get `source: "legacy"` (no badge). |
| **Case study from verified work** | Case studies linked to at least one of `deal_id` or `gig_deal_id` (server-side only) get `from_verified_work: true`; `CaseStudyCard` shows “From verified work” badge. |
| **Reviews section context** | When there is at least one review, sublabel “From completed work” appears under the section title. |
| **Payload consistency** | All reviews have `source`; all case studies have `from_verified_work` boolean. No new proof paths; only existing completed deal/gig_deal linkage is reflected. |

---

## 4. What remains intentionally private

The following are **not** exposed on the public profile or in the public API response:

- `deal_id`, `gig_deal_id`, `collab_request_id`, `converted_gig_deal_id`
- Internal statuses (e.g. deal status, collab request status)
- Private notes, reply notes, follow-up notes
- Internal IDs (e.g. reviewer_profile_id, reviewee_profile_id) in the payload — only public display names/avatars are used
- Non-public counterparty details
- Exact workflow history (that belongs on `/profile/work` and `/profile/deals` only)

The `case_studies` table is queried server-side for `id, deal_id, gig_deal_id` only to compute the boolean `from_verified_work`; those IDs are never sent to the client.

---

## 5. Tests added

| Test file | What it covers |
|-----------|----------------|
| **`apps/web/src/lib/buildPublicProfilePayload.test.ts`** | (1) Valid payload with case studies and reviews has no forbidden keys (`deal_id`, `gig_deal_id`, `collab_request_id`, `converted_gig_deal_id`) anywhere. (2) Throws if `deal_id` appears in case studies. (3) Throws if `gig_deal_id` appears in reviews. (4) Proof-backed case study has `from_verified_work` true/false as appropriate. (5) Reviews have `source` "collab" or "legacy". |

Run: `pnpm test:route -- src/lib/buildPublicProfilePayload.test.ts` (from `apps/web`).

---

## 6. Route-level and E2E verification (added)

### 6.1 Exact tests added

| Layer | File | What it covers |
|-------|------|----------------|
| **Route** | `apps/web/src/app/api/public/profile/route.test.ts` | GET 400 when username missing or empty; GET 404 when entity not found; GET 200 with mocked entity/payload: response has `reviews.latest[].source` (collab/legacy), `caseStudies[].from_verified_work`, and no forbidden keys in payload. |
| **E2E API** | `apps/web/e2e/public-profile-proof.spec.ts` | API: 400 missing username, 404 not found; 200 with proof shape when `E2E_FIXTURE_USERNAME` is set; response body has no forbidden keys. |
| **E2E browser** | Same spec | Visit `/{E2E_FIXTURE_USERNAME}` when fixture enabled; assert reviews/case-studies sections, "From completed work", "Verified" badge, "From verified work"; no deal_id/gig_deal_id in page content. |

### 6.2 Fixture and test-only branches

- **`apps/web/src/lib/e2ePublicProfileFixture.ts`** — Exports `e2eProofFixture` and `E2E_FIXTURE_USERNAME = "e2e-proof-fixture"`.
- **API route** — When `E2E_FIXTURE_USERNAME` env is set and norm matches, returns fixture JSON (no DB).
- **`[username]` page** — When `E2E_FIXTURE_USERNAME` is set and segment matches, renders `PublicProfileContent` with fixture.
- **Playwright webServer** — Passes `E2E_FIXTURE_USERNAME=e2e-proof-fixture` when starting dev server.

### 6.3 Minimal selectors

- `data-testid="public-profile-reviews"`, `public-profile-from-completed-work`, `public-profile-case-studies`.

### 6.4 What live proof signals are verified

Route test: reviews have `source`, case studies have `from_verified_work`, no forbidden keys in API response. E2E: Verified badge, "From verified work", "From completed work" visible; no private keys in DOM.

### 6.5 Bugs found and fixed

None. Fixture path is additive and gated by env.

### 6.6 Remaining gaps

- E2E against a real profile (no fixture) not added; optional env `E2E_PUBLIC_PROFILE_USERNAME` could be used with seed data.
- Org public profile proof signals could be extended later.

---

## 7. Remaining deferred items

- **E2E for public profile:** Optional Playwright test that loads `/{username}` and asserts presence of “Verified” on reviews and “From verified work” on case studies (and absence of deal_id/gig_deal_id in response or DOM). Not required for this deliverable.
- **Org public profile:** Current proof indicators are implemented for profile-owned entities; org public profile behavior is unchanged and can be extended later if needed.
- **Featured review/case study:** Featured items already receive the same `source` / `from_verified_work` treatment when rendered in PublicProfileContent.
- **Real-profile E2E:** Optional test that visits a seeded or known real username (requires DB seed or env).

---

## 8. Final regression checklist

- [ ] **Routes:** Public profile remains `/{username}`; `/profile/work` and `/profile/deals` remain internal authenticated surfaces; no new public routes added.
- [ ] **Privacy:** No `deal_id`, `gig_deal_id`, or other internal workflow IDs in public payload or DOM; unit test and route test enforce forbidden keys; E2E asserts no private keys in API response and in page content.
- [ ] **Proof rules:** Reviews only from completed verified work; case study “from verified work” only when linked to completed deal/gig_deal; no fake proof paths.
- [ ] **UI:** Verified badge appears when `source === "collab"`; “From verified work” appears on case studies when `from_verified_work === true`; “From completed work” sublabel under Reviews when count > 0; E2E fixture run verifies these in the browser.
- [ ] **Existing behavior:** Public profile layout, sections, and empty states unchanged except for the added indicators, sublabel, and minimal data-testids.
- [ ] **Tests:** `pnpm test:route` includes `buildPublicProfilePayload.test.ts` and `api/public/profile/route.test.ts`; `pnpm test:e2e` runs `public-profile-proof.spec.ts` (chromium; fixture enabled when webServer is started by Playwright with `E2E_FIXTURE_USERNAME`).
