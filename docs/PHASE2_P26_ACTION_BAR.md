# Phase 2 P2.6–P2.7: Public Profile Action Bar + Featured Fallbacks

## Overview

1. **Action Bar:** A small CTA module on the public profile page (`/{username}`) that guides the next action (collab, post gig, browse, view insights). Safe when not logged in (sign-in CTAs).
2. **Featured fallbacks:** When no featured ID is set, automatically pick a sensible default (newest / best) so the Featured block shows content when data exists. Manual selection always overrides.

No DB migrations, no new public endpoints. Token-based styling. Layout order/hidden and presets unchanged.

---

## Routes used for Action Bar CTAs

| CTA | Route | When |
|-----|--------|------|
| Request collab / Sign in to contact | Profile URL or `/login?redirect=...` | Individual |
| View Insights | `/u/[username]/insights` | All (noindex) |
| Post a gig / Sign in to post a gig | `/profile/edit` or `/login?redirect=/profile/edit` | Project/company |
| Browse creators | `/explore` | Project/company |

---

## Profile-type rules (Action Bar)

| Profile type | Primary | Secondary | Tertiary |
|--------------|---------|-----------|----------|
| **Individual** | “Request collab” (or “Sign in to contact” when not auth) | “View Insights” → `/u/[username]/insights` | — |
| **Project / Company** | “Post a gig” (or “Sign in to post a gig” when not auth) | “Browse creators” → `/explore` | “View Insights” → `/u/[username]/insights` |

- `isAuthenticated` comes from server session on the slug branch; when false, primary CTA links to login with appropriate `redirect`.
- `canApplyToGigs` is passed as `isAuthenticated` (used if we add apply-from-bar later). All actions are safe for unauthenticated users (sign-in flows).

---

## Featured fallbacks

- **Manual selection:** If `featured_case_study_id` / `featured_review_id` / `featured_gig_id` is set, that item is used (when present in the list).
- **Fallback when ID not set:**
  - **Case study:** Prefer items with both `url` and `summary`; otherwise any; pick first from that pool. (No `created_at` in payload, so “newest” is not used.)
  - **Review:** Sort by `rating` desc, then `created_at` desc; pick first.
  - **Gig (project/company only):** Sort by `created_at` desc; pick first.
- If the list is empty, that featured slot is skipped. Compact preset never shows the Featured block (unchanged).

---

## Layout

- **Section key:** `action_bar`.
- **Presets:** Included in default order for classic, spotlight, showcase, compact (e.g. after `trust_strip`, before or with `featured`). Right column.
- **Hide/reorder:** Controlled via layout editor (SECTION_KEYS + merge on load).

---

## Files changed

| Path | Change |
|------|--------|
| `apps/web/src/app/(public)/[username]/ActionBar.tsx` | **New.** Action bar: profileType, username, profileUrl, isAuthenticated, canApplyToGigs; Individual vs project/company CTAs; sign-in redirects when not auth. |
| `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` | Optional `isAuthenticated` prop; `action_bar` section renders ActionBar; featured fallbacks for case study, review, gig when featured_*_id unset. |
| `apps/web/src/app/(public)/[username]/page.tsx` | Slug branch: get current user (server), set `isAuthenticated`, pass to PublicProfileContent. |
| `apps/web/src/lib/publicLayoutPresets.ts` | Add `action_bar` to SECTION_KEYS and RIGHT_COLUMN_KEYS; add to all preset default orders. |
| `docs/PHASE2_P26_ACTION_BAR.md` | This doc. |

---

## QA checklist

- [ ] Action bar shows correct CTAs per profile type (individual vs project/company).
- [ ] Not logged in: primary/secondary use sign-in or safe links.
- [ ] View Insights goes to `/u/[username]/insights`.
- [ ] Featured block shows a case study / review / gig when data exists and no featured ID is set.
- [ ] Manual featured IDs still override fallbacks.
- [ ] Compact never shows featured; empty lists skip featured slot.
- [ ] Layout order and hidden control `action_bar`; build passes.
