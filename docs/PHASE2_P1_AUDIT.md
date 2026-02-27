# Linkary Phase 2 (P1) — Authority + Storytelling — Audit & change log

## Step 0 — Verified existing shape

### A) profiles.public_layout structure
- **Where stored:** `profiles.public_layout` (jsonb). Fetched via `public_profile_view` / `public_profile_preview_view` (column `public_layout` in viewCols).
- **Keys in use today:**
  - `preset`: string — "classic" | "spotlight" | "showcase" | "compact". Set via `updateMyProfile(..., { public_layout_preset })`; merged in `lib/profiles.ts`.
  - `order`: string[] — section keys order. Set via `PUT /api/public/layout` body `layout.order`. Merge in route preserves existing `preset` when updating.
  - `hidden`: string[] — section keys to hide. Set via `PUT /api/public/layout` body `layout.hidden`. Route uses `layout.hidden ?? []`.
- **Confirmed:** `preset` is at `public_layout.preset`. No migrations; all new keys (order, hidden, featured_*) live in same jsonb.

### B) Data already on public page payload
- **Case studies:** `data.caseStudies` — array of `{ id, title, summary, tags, url }`. IDs available.
- **Gigs:** `data.gigs` — array of `{ id, title, description, ... }`. IDs available.
- **Reviews:** `data.reviews.latest` — array of `{ rating, title, text, created_at, reviewer_display, reviewer_avatar_url, verified_deal }`. Review **id** exists in DB (`reviews.id`) but was not included in payload; added in P1 so featured_review_id can resolve.
- **Entity IDs for featured selection:** `case_study.id`, `gig.id`, `review.id` (after adding id to reviews.latest).

### C) Sections in PublicProfileContent (current render order)
- **Left column:** header (avatar, name, bio, proof stats), socials, proof (reputation/xscore/ethos).
- **Right column (fixed order today):** token (project), team (company), relations (ambassador/affiliate/…), gigs, skills, achievements, case_studies, links, reviews.
- **Canonical section keys used for order/hide:**  
  `hero`, `header`, `socials`, `proof`, `token`, `team`, `gigs`, `relations`, `skills`, `achievements`, `case_studies`, `links`, `reviews`.  
  Plus virtual block: `featured` (rendered when featured_* are set; compact does not show featured).

### Default order per preset
- **classic:** hero, header, socials, proof, token, team, gigs, relations, skills, achievements, case_studies, links, reviews.
- **spotlight:** same, with featured after socials (story order; proof early).
- **showcase:** featured first (after hero/socials), then rest.
- **compact:** same keys; featured not rendered; default hidden can include e.g. relations if desired (optional).

---

## Changes made (summary)

### Payload & types
- **Slug page:** Reads full `public_layout` from view; passes `layout_order`, `layout_hidden`, `featured_case_study_id`, `featured_review_id`, `featured_gig_id` in payload. Reviews.latest items include `id`.
- **PublicProfileApiPayload:** `profile.public_layout` extended to optional `layout_order`, `layout_hidden`, `featured_case_study_id`, `featured_review_id`, `featured_gig_id`. `reviews.latest[].id` added.

### Public page (PublicProfileContent)
- **Featured blocks:** Rendered when preset !== "compact" and corresponding featured id is set and item exists. Individual: featured case study + featured review. Project/company: featured gig + featured case study + featured review. Fail gracefully if not found.
- **Section order + hide:** Canonical section keys; if `layout_order` present use it (filter to known keys); if `layout_hidden` includes a key, skip that section. Type-aware sections (token=project, team=company, achievements=individual) unchanged.

### ProfileEditPage (owner)
- **Featured selectors:** Dropdowns for featured case study, featured gig (project/company), featured review; "Clear" per slot. Load options from existing APIs/data (case studies, gigs, reviews for profile).
- **Section order + hide:** List of sections with Up/Down and hide toggle; save via existing `updateMyProfile` / layout merge; preserve preset.

### API / save
- **updateMyProfile:** Accepts `public_layout_order`, `public_layout_hidden`, `featured_case_study_id`, `featured_review_id`, `featured_gig_id`; merges into `profiles.public_layout` without overwriting preset.
- **PUT /api/public/layout:** Merge already preserves preset; no change except possibly accepting featured_* if we ever move to that route (not required for P1).

---

## Section keys (canonical)
hero, header, socials, proof, token, team, gigs, relations, skills, achievements, case_studies, links, reviews, featured

## Default order (classic)
hero, header, socials, proof, featured, token, team, gigs, relations, skills, achievements, case_studies, links, reviews

---

## File paths touched

| Path | Change |
|------|--------|
| `docs/PHASE2_P1_AUDIT.md` | New: Step 0 checklist, section keys, default order, change log |
| `apps/web/src/app/api/public/profile/route.ts` | Extended `PublicProfileApiPayload.profile` with layout_order, layout_hidden, featured_*; reviews.latest[].id |
| `apps/web/src/app/(public)/[username]/page.tsx` | Read full public_layout from view; pass layout_order, layout_hidden, featured_*; add id to reviewsLatest |
| `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` | SECTION_KEYS; featured block (case study, gig, review); layoutHidden checks on all sections; showFeatured (no featured in compact) |
| `apps/web/src/lib/profiles.ts` | updateMyProfile: merge public_layout_order, public_layout_hidden, featured_case_study_id, featured_review_id, featured_gig_id into public_layout |
| `apps/web/src/app/api/public/layout/route.ts` | Merge keeps full existingLayout (preserves featured_*) |
| `apps/web/src/figma/app/components/ProfileEditPage.tsx` | State: layoutOrder, layoutHidden, featured*; loadMyReviews; load/save layout + featured from public_layout; UI: Featured dropdowns + Clear; Section order & visibility (Up/Down + hide toggle) |
