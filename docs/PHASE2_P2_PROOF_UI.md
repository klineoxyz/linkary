# Phase 2 P2: Premium Proof UI on Public Profiles

## Overview

Upgrades the public profile (`/{username}`) Case Studies and Reviews sections into a premium portfolio and trust layer:

1. **Case studies** → “Proof Cards” with structured highlights.
2. **Reviews** → “Top verified review” first, then compact cards; verified badge and clamped text.

No schema migrations. Uses existing payload; token-based styling only. Layout order/hidden and presets unchanged.

---

## Data assumptions

### Case studies payload (unchanged)

Each item has:

- `id`, `title`, `summary`, `tags[]`, `url`

No `outcome`/`results` or `cover_image_url` in DB; none added. Highlights are derived client-side from `summary` and `tags`.

### Reviews payload (unchanged)

- `reviews.average`, `reviews.count`
- `reviews.latest[]`: `id?`, `rating`, `title`, `text`, `created_at`, `reviewer_display`, `reviewer_avatar_url`, `verified_deal?`

All confirmed present in public payload (slug page and API route).

---

## What changed

### 1. Case study “Proof Card” UI

**Location:** `PublicProfileContent.tsx` → `case "case_studies"`.

- **Layout:** Grid: 1 column on mobile, 2 on desktop (`grid-cols-1 md:grid-cols-2`).
- **Card structure:**
  - **Header:** Title + tag pills (border/muted).
  - **Body:** Summary (line-clamp-3) + **Highlights** list (2–4 bullets).
  - **Footer:** “View case study” link (existing `url`).

- **Highlights (no DB):**
  - Helper `proofHighlights(summary, tags)`:
    - If `summary` exists: split on sentence boundaries (`.!?`), take up to 3 sentences.
    - If fewer than 3 bullets: add tag-based bullets (“Worked on: {tag}”) up to 2.
  - Max 4 bullets shown.

- Empty state unchanged. Responsive and works with classic/spotlight/showcase/compact.

### 2. Reviews “top first” + premium compact cards

**Location:** `PublicProfileContent.tsx` → `case "reviews"`.

- **Sort (client-side):** `reviews.latest` sorted by:
  1. `rating` descending.
  2. `created_at` descending (newest first when rating ties).

- **First review:** Rendered as **“Top verified review”** card:
  - Label: “Top verified review”.
  - Slightly emphasized (border-primary/20, p-5, larger avatar).
  - Verified badge shown when `verified_deal !== false`.
  - Review text clamped to 4 lines (`line-clamp-4`).

- **Remaining reviews:** Compact cards (smaller avatar, `line-clamp-3` for text). Same verified badge.

- Section header and aggregate (stars + “X verified reviews”) unchanged. Empty state unchanged. No analytics or new endpoints.

---

## Files changed

| Path | Change |
|------|--------|
| `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` | `proofHighlights()` helper; case_studies → Proof Card grid + highlights; reviews → sort, top card + compact list, verified badge, line-clamp. |
| `docs/PHASE2_P2_PROOF_UI.md` | This doc. |

---

## QA checklist

- [ ] No case studies: empty state “No case studies yet” unchanged.
- [ ] No reviews: empty state “No reviews yet” unchanged.
- [ ] Case studies: Proof Cards show title, tags, summary, derived highlights, “View case study” link; 1 col mobile, 2 col desktop.
- [ ] Reviews: sorted by rating then date; first = “Top verified review”; rest compact; verified badge on each; long text clamped.
- [ ] Layout order/hidden still controls case_studies and reviews sections.
- [ ] Works for presets: classic, spotlight, showcase, compact.
- [ ] Build passes.
