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
| header media | profile_media (header_media_*) | No | Yes (header_media section; image/video block) | Yes | Yes | Implemented P10.2: section "header_media", signed/legacy URL. |
| token_dexscreener_url | profiles.token_dexscreener_url | No | Yes (token section, project) | Yes | Yes | |
| Section visibility (hidden) | profiles.public_layout.hidden | N/A | Yes | Yes | N/A | resolvedHidden filters visibleOrder |
| Section order | profiles.public_layout.order | N/A | Yes | N/A | Yes | visibleOrder = order \ hidden; leftOrder/rightOrder drive render |
| Layout mode (preset) | profiles.public_layout.preset | No | Yes | N/A | N/A | classic/spotlight/showcase/compact; spacing/columns follow preset. MISSING_PROFILE: dashboard does not show preset |
| featured_case_study_id | profiles.public_layout.featured_case_study_id | No | Yes (featured block) | N/A | N/A | Featured section; case_studies list order pinned below |
| featured_review_id | profiles.public_layout.featured_review_id | No | Yes (featured block) | N/A | N/A | |
| featured_gig_id | profiles.public_layout.featured_gig_id | No | Yes (featured block, project/company) | N/A | N/A | |
| show_reviews | profiles.show_reviews | No (reviews count only) | Yes (reviews section hidden when false) | Yes | N/A | renderSection("reviews") returns null when !showReviews |
| CV / cv_document_id | profiles.cv_document_id, profile_documents | No | Yes (cv section; Download CV link → /api/public/cv/[username]) | Yes | Yes | Implemented P10.2: section "cv", safe redirect to signed URL. |
| Roles (professions) | profile_professions (junction) | Yes (Overview role tags) | Yes (roles section; tags from professions) | Yes | Yes | Implemented P10.2: section "roles". |
| Socials (x, telegram, linkedin, youtube, website) | profile_socials | No (dashboard no socials block) | Yes (socials section) | Yes | Yes | MISSING_PROFILE |
| Skills | profile_skills (is_public, sort_order) | No | Yes (skills section) | Yes (is_public) | Yes (API sort_order) | MISSING_PROFILE |
| Achievements | profile_achievements (is_public, sort_order) | No | Yes (achievements section, individual) | Yes (is_public) | Yes | MISSING_PROFILE |
| Links | profile_links (is_public, sort_order) | No | Yes (links section) | Yes (is_public) | Yes | MISSING_PROFILE |
| Relations | profile_relations (is_public, sort_order) | Yes (Ambassador of) | Yes (relations/ecosystem) | Yes (is_public) | Yes | |
| Partner programs | partner_programs (is_featured, sort_order) | No | Yes (partner_programs section; cards with logo, link) | Yes | Yes | Implemented P10.2: section "partner_programs". |
| Case studies | case_studies (is_public) | Yes (Overview list) | Yes (case_studies + featured) | Yes (is_public) | Yes | Featured pinned in featured block; case_studies list order fixed to show featured first |
| Reviews | reviews (when show_reviews) | Yes (stats) | Yes (reviews section when show_reviews) | Yes | Yes | |
| Team | org_team_members (is_public, company) | No | Yes (team section) | Yes (is_public) | Yes | MISSING_PROFILE |
| Gigs | gigs (is_public, project/company) | No | Yes (gigs section) | Yes (is_public) | Yes | MISSING_PROFILE |

## Mismatches summary (post P10.2)

- **MISSING_PROFILE:** hero, header media, layout preset, featured IDs, show_reviews toggle display, socials, skills, achievements, links, team, gigs. Internal /profile is a dashboard; "Public preview" tab shows 1:1 iframe of /[username].
- **MISSING_PUBLIC:** None. Header media, CV, partner programs, roles implemented on public one-pager (sections header_media, cv, partner_programs, roles).
- **VISIBILITY_BUG:** None. Public page uses resolvedHidden and show_reviews.
- **ORDER_BUG:** None. Public page uses visibleOrder from stored order + hidden.

## Fixes applied (P10 + P10.2)

1. **Featured case study pinned in list:** In PublicProfileContent, the "case_studies" section sorts so the featured case study (when set) appears first.
2. **Layout / visibility:** Public page uses stored order and hidden; layout mode drives layout.
3. **Internal /profile:** "Public preview" tab added; renders iframe of /[username] so users can verify Builder changes without leaving the app.
4. **P10.2 — Builder fields on public:** Header media (section header_media), CV (section cv, link to /api/public/cv/[username]), Partner programs (section partner_programs), Roles (section roles, from profile_professions). All in SECTION_KEYS and preset order.
5. **Copy profile link:** URL uses canonical base (NEXT_PUBLIC_APP_URL or https://linkary.xyz) so copied link is production, not deployment URL.
6. **P10.1 UI polish:** Section titles use text-primary; major sections wrapped in island cards (islandClass); no new colors.

## QA checklist

- [ ] Changing section order in builder updates public page after save and refresh.
- [ ] Changing section visibility (hidden) hides that section on public page.
- [ ] Toggling "Show reviews on public profile" hides/shows reviews section on public page.
- [ ] Featured case study appears in Featured block and appears first in Case studies list when set.
- [ ] Featured review appears in Featured block when set.
- [ ] Layout mode (classic / spotlight / showcase / compact) changes public page layout (columns, spacing).
- [ ] No builder setting is orphaned: all builder fields either appear on /profile (dashboard), or on /[username], or are intentionally private (e.g. email).
- [ ] **P10.2:** /profile → Public preview tab shows iframe of /[username]; layout/order/hidden/featured match.
- [ ] **P10.2:** Header media, CV, Partner programs, Roles appear on public page when configured.
- [ ] Copy profile link copies canonical URL (e.g. https://linkary.xyz/username when NEXT_PUBLIC_APP_URL is set).
- [ ] Public page sections use island cards and section titles have Linkary accent (text-primary).
