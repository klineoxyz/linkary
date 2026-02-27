# Phase 2 P1.5: Public layout ORDER rendering + real preset defaults

## Overview

- **`public_layout.order`** controls section render order on the public SEO profile page (`/{username}`).
- **`public_layout.hidden`** continues to work as before (section keys to hide).
- Presets (classic, spotlight, showcase, compact) are meaningfully different via **preset default orders** and **preset default hidden** (compact only) when the user has not customized order/hidden.

No new DB columns or migrations; everything stays in `profiles.public_layout` jsonb.

---

## Preset default orders

When the user has **not** saved a custom order (`layout_order` missing or empty), the public page uses:

| Preset    | Default order |
|-----------|----------------|
| **classic**  | hero, header, socials, proof, **trust_strip**, featured, token, team, gigs, relations, skills, achievements, case_studies, links, reviews |
| **spotlight**| Same as classic; layout is **1-column** stacked. |
| **showcase** | hero, header, **featured**, proof, **trust_strip**, socials, case_studies, reviews, gigs, relations, token, team, skills, achievements, links |
| **compact**  | hero, header, socials, proof, **trust_strip**, token, team, gigs, relations, skills, achievements, case_studies, links, reviews (no `featured` in order). |

---

## Preset default hidden

When the user has **not** saved a custom hidden list (`layout_hidden` not provided), the public page uses:

| Preset    | Default hidden |
|-----------|----------------|
| classic   | (none) |
| spotlight | (none) |
| showcase  | (none) |
| **compact** | relations, links |

Compact never shows the featured block (handled in code; `featured` is not in compact’s default order).

---

## Order-driven rendering (how it works)

1. **Resolved order**  
   `resolvedOrder = (layout_order if valid and non-empty) else PRESET_DEFAULT_ORDER[preset]`  
   Filter to known section keys only.

2. **Resolved hidden**  
   `resolvedHidden = (layout_hidden if provided) else PRESET_DEFAULT_HIDDEN[preset]`  
   (compact default: `["relations", "links"]`.)

3. **Visible order**  
   `visibleOrder = resolvedOrder.filter(k => !resolvedHidden.has(k))`

4. **Column assignment (2-column presets: classic, showcase, compact)**  
   - **Left column:** keys in `visibleOrder` that are in `LEFT_COLUMN_KEYS`: `header`, `socials`, `proof`, `trust_strip`.  
   - **Right column:** keys in `visibleOrder` that are in `RIGHT_COLUMN_KEYS`: `featured`, `token`, `team`, `gigs`, `relations`, `skills`, `achievements`, `case_studies`, `links`, `reviews`.  
   - Sections are rendered in the same order they appear in `visibleOrder` within each column.

5. **Spotlight (1-column)**  
   All sections in `visibleOrder` (except hero) are rendered in a single column in order. Hero remains full-width above.

6. **Hero**  
   Rendered full-width first only when `hero` is in `visibleOrder` and hero image/video exists.

7. **Type-aware rules** (unchanged)  
   - **token:** project only.  
   - **team:** company only.  
   - **achievements:** individual only.  
   - **featured:** never in compact; only when preset ≠ compact and featured content exists.  

These checks are applied inside each section’s render function; if order includes a key but the type doesn’t match, that section returns null.

---

## Section keys (canonical)

`hero`, `header`, `socials`, `proof`, `trust_strip`, `featured`, `token`, `team`, `gigs`, `relations`, `skills`, `achievements`, `case_studies`, `links`, `reviews`

---

## P2-lite: Trust Strip

- **Section key:** `trust_strip`.
- **Component:** `@/components/TrustStrip.tsx` — compact row of pills (score, tier, Verified, reviews, X handle). All props optional; renders safely with partial data.
- **Public page:** Rendered in left column when `trust_strip` is in visible order. Uses `profile.reputation_index`, `reviews.average`/`reviews.count`, and `socials.x` (for “X” pill). No new payload fields.
- **Insights Snapshot:** Same component below `ProfileHeaderCard`; own profile uses me-stats (reputationIndex, verifiedGigsCount, reviews); other users use public dto (score/linkaryPower, X handle when available). Can be hidden and reordered via ProfileEditPage like other sections.

---

## Files changed

| Path | Change |
|------|--------|
| `apps/web/src/lib/publicLayoutPresets.ts` | SECTION_KEYS (incl. `trust_strip`), LEFT_COLUMN_KEYS (incl. `trust_strip`), PRESET_DEFAULT_ORDER updated. |
| `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` | Order-driven rendering; `trust_strip` case renders TrustStrip (score, tier, reviews, X). |
| `apps/web/src/components/TrustStrip.tsx` | **New.** Reusable Trust Strip component (score, tierLabel, verifiedGigsCount, reviewsAvg/Count, xHandle; variant public/insights). |
| `apps/web/src/figma/app/components/ProfileEditPage.tsx` | Preset defaults; “Reset to preset defaults”; load order merges missing SECTION_KEYS so trust_strip is reorderable/hideable. |
| `apps/web/src/figma/app/components/profile/InsightsSnapshot.tsx` | TrustStrip below ProfileHeaderCard (own: me-stats + X; other: score + handle). |
| `docs/PHASE2_P15_LAYOUT_ORDER.md` | This doc; trust_strip key and P2-lite section. |

---

## QA checklist

- [ ] `/{username}` with preset **classic**: section order matches classic default; custom order overrides when saved.
- [ ] Preset **spotlight**: single-column stacked; same order as classic.
- [ ] Preset **showcase**: featured early; case_studies, reviews before gigs/relations.
- [ ] Preset **compact**: no featured block; relations and links hidden by default when hidden not customized.
- [ ] Custom order and custom hidden are respected when set.
- [ ] Hidden works with order (sections in resolvedHidden are skipped).
- [ ] Unpublished preview still works and remains noindex.
