# Launch Readiness P1: Public Profile Empty-State “Starter Block” + Above-the-Fold

## Goal

Public profiles should not look empty or blank. When a profile has minimal content, show a “Starter Block” and keep key sections above the fold. Empty sections use clear, actionable copy.

## Constraints

- No DB migrations. No changes to publish gating, SEO, or views.
- Token-based styling only. Layout order/hidden system unchanged.

---

## Section key: `starter_block`

- **Type:** Virtual section (no DB field; show/hide by content rules).
- **Placement:** In `SECTION_KEYS` and `RIGHT_COLUMN_KEYS`. In default preset orders: after `action_bar`, before `featured` (classic, spotlight, showcase, compact).
- **Render rules:** Shown only when the profile is “low content”:
  - No hero (no hero image, no hero video, no hero title), and
  - No case studies, and
  - No reviews (count === 0), and
  - For project/company: no open gigs and no ecosystem relations (ambassadors, affiliates, ecosystem projects, subsidiaries).
- **Content:**
  - **Visitor:** Short line (“This profile is getting started…”) + “View Insights” + “Sign in to contact”.
  - **Owner:** Detected client-side via `GET /api/me/profile-status?username=...` (when status is `published` or `unpublished`). “Complete your profile” checklist with links to `/profile/edit` and anchors `#basics`, `#case-studies`, `#gigs` (for org). If owner cannot be detected, visitor view is used.
- **Graceful failure:** If session or profile-status fails, owner view is not shown; visitor view is used.

---

## Above-the-fold defaults

- Preset default orders already include: `header`, `proof`, `trust_strip`, `action_bar`, `starter_block`, `featured`.
- User’s saved order is never overwritten. ProfileEditPage continues to merge missing `SECTION_KEYS` into the editor list so new keys (e.g. `starter_block`) appear and can be reordered/hidden.
- **Optional warning:** In ProfileEditPage, when the user hides **header**, **proof**, and **action_bar** at once, a short warning is shown: “Hiding header, proof, and action bar may make your profile look empty above the fold. Consider showing at least one.”

---

## Empty-state copy

| Section       | New copy |
|---------------|----------|
| Reviews       | “Verified reviews appear after completed deals.” |
| Case studies  | “Add a proof card to show outcomes.” |
| Open gigs     | “No open gigs yet.” (section still rendered for project/company when in order.) |
| Ecosystem     | “No partners added yet.” (when relations section is visible but has no ambassadors/affiliates/ecosystem/subsidiaries.) |

---

## Gigs and relations behavior

- **Gigs:** For project/company, the “gigs” section is rendered even when there are no open gigs; it shows the empty state “No open gigs yet.” and uses `id="gigs"` for anchor.
- **Relations (project/company):** When “relations” is in the order but there are no relation groups (no ambassadors, affiliates, ecosystem projects, subsidiaries), the Ecosystem section is still rendered with title “Ecosystem” and empty state “No partners added yet.” instead of returning null.

---

## Files changed

| Path | Change |
|------|--------|
| `apps/web/src/lib/publicLayoutPresets.ts` | Added `starter_block` to `SECTION_KEYS` and `RIGHT_COLUMN_KEYS`. Added to all four preset default orders (after `action_bar`, before `featured` or in same region). |
| `apps/web/src/app/(public)/[username]/StarterBlock.tsx` | **New.** Client component: shows when `isLowContent`; visitor view (explanation + View Insights + Sign in to contact); owner view (Complete your profile checklist) after client-side profile-status check. |
| `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` | Computes `hasHero`, `hasAnyRelation`, `isLowContent`. Added `starter_block` case (render only when `isLowContent`). Relations: project/company empty state “No partners added yet.” when no groups. Gigs: project/company empty state “No open gigs yet.” when no gigs; section still rendered. Updated empty copy for case studies, reviews. |
| `apps/web/src/figma/app/components/ProfileEditPage.tsx` | Warning when user hides header, proof, and action_bar together. |
| `docs/LAUNCH_P1_PUBLIC_EMPTY_STATE.md` | This doc. |

---

## QA

- [ ] Fresh / minimal profile shows Starter Block (no hero, no case studies, no reviews, no gigs/relations for org).
- [ ] Starter Block disappears when profile has enough content (e.g. case study or review added).
- [ ] Owner sees “Complete your profile” checklist when viewing own low-content profile; visitor sees “Get started” + CTAs.
- [ ] Presets (classic, spotlight, showcase, compact) include `starter_block` in default order; section can be hidden/reordered.
- [ ] Empty states show new copy for reviews, case studies, gigs, ecosystem.
- [ ] ProfileEditPage shows warning when header, proof, and action_bar are all hidden.
- [ ] Build passes.
