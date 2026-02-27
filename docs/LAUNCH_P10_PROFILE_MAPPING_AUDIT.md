# Launch P10: Profile Builder → Profile → Public mapping audit and fix

## Goal

Ensure every configurable section in Profile Builder is stored correctly, visible where intended, and respects visibility toggle, section order, featured selection, and layout mode. Structural audit and alignment only—no redesign or new features.

## Deliverables

1. **Mapping matrix:** `docs/PROFILE_MAPPING_MATRIX.md`  
   - Table: Builder field → DB column → Used in /profile → Used in /[username] → Respects visibility → Respects order → Notes.  
   - Mismatch flags: MISSING_PROFILE, MISSING_PUBLIC, VISIBILITY_BUG, ORDER_BUG.  
   - All builder fields enumerated (top-level fields, section visibility, section order, featured, hero, header media, CV, roles, socials, skills, achievements, links, relations, partner programs, layout mode).

2. **Findings**
   - **Section order:** Public page already uses stored order: `visibleOrder` from `layout_order` + `layout_hidden`; `leftOrder` / `rightOrder` drive render; no hardcoded section sequence. No change.
   - **Visibility:** Public page already uses `resolvedHidden` and `show_reviews`; sections in `hiddenSet` are excluded; `renderSection("reviews")` returns null when `!showReviews`. No change.
   - **Layout mode:** Preset (classic/spotlight/showcase/compact) already drives layout (columns, spacing). No change.
   - **Featured:** Featured case study was shown in the Featured block but not pinned first in the Case studies list. **Fix:** In `PublicProfileContent.tsx`, the "case_studies" section now sorts the list so the featured case study (when set) appears first.

3. **Internal /profile**  
   - ProfilePage is a dashboard (Overview, case studies, work, scores). It does not use section order or visibility; those apply only to the public one-pager. Many builder fields (hero, socials, skills, etc.) are not rendered on the dashboard by design. Documented in matrix as MISSING_PROFILE where applicable.

## Files changed

- **Added:** `docs/PROFILE_MAPPING_MATRIX.md` — full mapping table, mismatch summary, fixes applied, QA checklist.
- **Added:** `docs/LAUNCH_P10_PROFILE_MAPPING_AUDIT.md` — this file.
- **Modified:** `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` — case "case_studies": sort case studies so featured (when set) is first in the list.

## QA checklist (from matrix)

- [ ] Changing section order in builder updates public page after save and refresh.
- [ ] Changing section visibility (hidden) hides that section on public page.
- [ ] Toggling "Show reviews on public profile" hides/shows reviews section on public page.
- [ ] Featured case study appears in Featured block and appears first in Case studies list when set.
- [ ] Featured review appears in Featured block when set.
- [ ] Layout mode (classic / spotlight / showcase / compact) changes public page layout (columns, spacing).
- [ ] No builder setting is orphaned: all builder fields either appear on /profile (dashboard), or on /[username], or are intentionally private (e.g. email).
