# Profile Builder → Profile → Public mapping matrix

Structural audit: every Profile Builder field mapped to DB, internal /profile, and public /[username], with mismatch flags.

## Legend

- **Used in /profile:** Shown on internal profile page (App.tsx ProfilePage, dashboard/tabs). ProfilePage is a dashboard view (Overview, case studies, work, scores); it does not use section order or visibility—those apply only to the public one-pager.
- **Used in /[username]:** Rendered in PublicProfileContent (public one-pager).
- **Respects visibility:** Public page hides section when `layout_hidden` contains that section key (or preset default hidden).
- **Respects order:** Public page renders sections by iterating stored `layout_order` (or preset default); no hardcoded section sequence in render.
- **Notes:** MISSING_PROFILE = in builder but not shown on /profile. MISSING_PUBLIC = in builder but not shown on /[username]. VISIBILITY_BUG = visibility toggle ignored on public. ORDER_BUG = order config ignored.

---

| Builder field | DB column / source | Used in /profile | Used in /[username] | Respects visibility | Respects order | Notes |
|---------------|--------------------|------------------|----------------------|---------------------|----------------|-------|
| display_name | profiles.display_name | Yes (header) | Yes (header) | N/A | N/A | |
| email | profiles.email | No (private) | No | N/A | N/A | Contact only, not displayed publicly |
| bio | profiles.bio | Yes (Overview) | Yes (header) | N/A | N/A | |
| website | profiles.website, profile_socials.website_url | Yes (via links) | Yes (socials fallback) | N/A | N/A | |
| location | profiles.location | Yes (Overview) | Yes (header) | N/A | N/A | |
| profile_type | profiles.profile_type | Implied | Yes (header pill, sections) | N/A | N/A | |
| hero (image/video/title) | profiles.hero_image_url, hero_video_url, hero_title | No | Yes (hero section) | Yes | Yes | MISSING_PROFILE: dashboard has no hero block |
| header media | profile_media (header_media_*) | No | No (public one-pager has no header_media section) | N/A | N/A | MISSING_PUBLIC: header media not on public one-pager (only hero) |
| token_dexscreener_url | profiles.token_dexscreener_url | No | Yes (token section, project) | Yes | Yes | |
| Section visibility (hidden) | profiles.public_layout.hidden | N/A | Yes | Yes | N/A | resolvedHidden filters visibleOrder |
| Section order | profiles.public_layout.order | N/A | Yes | N/A | Yes | visibleOrder = order \ hidden; leftOrder/rightOrder drive render |
| Layout mode (preset) | profiles.public_layout.preset | No | Yes | N/A | N/A | classic/spotlight/showcase/compact; spacing/columns follow preset. MISSING_PROFILE: dashboard does not show preset |
| featured_case_study_id | profiles.public_layout.featured_case_study_id | No | Yes (featured block) | N/A | N/A | Featured section; case_studies list order pinned below |
| featured_review_id | profiles.public_layout.featured_review_id | No | Yes (featured block) | N/A | N/A | |
| featured_gig_id | profiles.public_layout.featured_gig_id | No | Yes (featured block, project/company) | N/A | N/A | |
| show_reviews | profiles.show_reviews | No (reviews count only) | Yes (reviews section hidden when false) | Yes | N/A | renderSection("reviews") returns null when !showReviews |
| CV / cv_document_id | profiles.cv_document_id, profile_documents | No | No | N/A | N/A | MISSING_PUBLIC: CV not on public one-pager |
| Roles (professions) | profile_professions (junction) | Yes (Overview role tags) | No (public one-pager has no "roles" section) | N/A | N/A | MISSING_PUBLIC: professions not a section on public |
| Socials (x, telegram, linkedin, youtube, website) | profile_socials | No (dashboard no socials block) | Yes (socials section) | Yes | Yes | MISSING_PROFILE |
| Skills | profile_skills (is_public, sort_order) | No | Yes (skills section) | Yes (is_public) | Yes (API sort_order) | MISSING_PROFILE |
| Achievements | profile_achievements (is_public, sort_order) | No | Yes (achievements section, individual) | Yes (is_public) | Yes | MISSING_PROFILE |
| Links | profile_links (is_public, sort_order) | No | Yes (links section) | Yes (is_public) | Yes | MISSING_PROFILE |
| Relations | profile_relations (is_public, sort_order) | Yes (Ambassador of) | Yes (relations/ecosystem) | Yes (is_public) | Yes | |
| Partner programs | partner_programs (is_featured, sort_order) | No | No (public one-pager has no partner section) | N/A | N/A | MISSING_PUBLIC: partner programs not rendered on public |
| Case studies | case_studies (is_public) | Yes (Overview list) | Yes (case_studies + featured) | Yes (is_public) | Yes | Featured pinned in featured block; case_studies list order fixed to show featured first |
| Reviews | reviews (when show_reviews) | Yes (stats) | Yes (reviews section when show_reviews) | Yes | Yes | |
| Team | org_team_members (is_public, company) | No | Yes (team section) | Yes (is_public) | Yes | MISSING_PROFILE |
| Gigs | gigs (is_public, project/company) | No | Yes (gigs section) | Yes (is_public) | Yes | MISSING_PROFILE |

## Mismatches summary

- **MISSING_PROFILE:** hero, header media, layout preset, featured IDs, show_reviews toggle display, socials, skills, achievements, links, team, gigs. Internal /profile is a dashboard and does not replicate the one-pager; only some fields (name, bio, location, roles, case studies, review stats) appear.
- **MISSING_PUBLIC:** header media (no section on public), CV, partner programs, roles/professions as a section. (Roles are not a SECTION_KEYS section on public.)
- **VISIBILITY_BUG:** None. Public page uses resolvedHidden and show_reviews.
- **ORDER_BUG:** None. Public page uses visibleOrder from stored order + hidden.

## Fixes applied (P10)

1. **Featured case study pinned in list:** In PublicProfileContent, the "case_studies" section now sorts the list so the featured case study (when set) appears first; others keep relative order.
2. **Layout / visibility:** No code change; public page already uses stored order and hidden. Layout mode (preset) already drives layout (spotlight vs 2-col, compact spacing).
3. **Internal /profile:** No structural change; dashboard remains separate from one-pager. Optional: show "Public layout: Classic" + link on /profile (not implemented to avoid scope creep).

## QA checklist

- [ ] Changing section order in builder updates public page after save and refresh.
- [ ] Changing section visibility (hidden) hides that section on public page.
- [ ] Toggling "Show reviews on public profile" hides/shows reviews section on public page.
- [ ] Featured case study appears in Featured block and appears first in Case studies list when set.
- [ ] Featured review appears in Featured block when set.
- [ ] Layout mode (classic / spotlight / showcase / compact) changes public page layout (columns, spacing).
- [ ] No builder setting is orphaned: all builder fields either appear on /profile (dashboard), or on /[username], or are intentionally private (e.g. email).
