# Launch P10.2: Profile system airtight + P10.1 UI polish

## Goals

1. **Builder must not lie:** Every Builder field either appears on the public one-pager (/[username]) or is clearly "internal only."
2. **/profile has 1:1 preview:** Public preview tab so users can verify Builder changes without leaving the app.
3. **Light UI polish:** Islands + Linkary accent on public page (no redesign).

---

## Part 1: P10.2 — Correctness

### A) Public preview inside /profile

- **Added:** "Public preview" tab on the profile page (App.tsx ProfilePage).
- **Behavior:** When selected, shows an iframe of `/[username]` (same origin). Respects Builder: layout preset, section order, hidden sections, show_reviews, featured pins. No new data model.
- **Disabled** when user has no public slug (username or X handle); message: "Set a username or connect X to enable."

### B) Builder fields now on public one-pager

| Item | Implementation |
|------|----------------|
| **Header media** | Section `header_media` in SECTION_KEYS and preset order. Renders image or video block (signed URL from profile_media or legacy URL). Left column. |
| **CV** | Section `cv`. When profile has `cv_document_id`, payload includes `cv: { download_url: "/api/public/cv/[username]" }`. Link "Download CV" → redirect to short-lived signed URL. GET /api/public/cv/[username] (no auth; published profiles only). |
| **Partner programs** | Section `partner_programs`. Payload loads from `partner_programs` (owner_type=profile). Renders cards (name, logo, description, website, Featured badge). |
| **Roles (professions)** | Section `roles`. Payload loads `profile_professions` + `professions(name)`, passes `profile.roles` as string[]. Renders as tag pills. |

All four are in `publicLayoutPresets.ts` (SECTION_KEYS, LEFT/RIGHT_COLUMN_KEYS, PRESET_DEFAULT_ORDER). Public page [username]/page.tsx loads the data and passes it in the payload; PublicProfileContent renders via `renderSection(key)`.

### C) Copy profile link — canonical URL

- **Issue:** Copy was using `baseUrl()` which fell back to `VERCEL_URL` on preview deployments, so users got e.g. `https://linkary-h0iz4nvj3-….vercel.app/username`.
- **Fix:** Introduced `canonicalBaseUrl()` that uses only `NEXT_PUBLIC_APP_URL` or `https://linkary.xyz`. The profile URL passed to PublicProfileContent (and thus to CopyProfileLinkButton) is built with `canonicalBaseUrl()`. Set `NEXT_PUBLIC_APP_URL=https://linkary.xyz` in production so the copied link is always the production URL.

---

## Part 2: P10.1 — UI polish

- **Section titles:** `SectionTitle` uses `text-primary` (Linkary accent).
- **Islands:** Major sections wrapped in `islandClass`: rounded-2xl border, bg-card, shadow-sm, hover:border-primary/10. Applied to: Proof, Featured, Skills, Achievements, Case studies, Links, Roles, CV, Partner programs, Reviews.
- No new colors; no heavy background effects; no data model changes.

---

## Files changed

- **apps/web/src/app/(public)/[username]/page.tsx** — `canonicalBaseUrl()`; profileUrl uses it; load profile_media, partner_programs, profile_professions; resolve header media URL; build rolesList, partnerProgramsPayload; payload: header_media, cv, partner_programs, profile.roles; profileExtData includes cv_document_id.
- **apps/web/src/app/(public)/[username]/PublicProfileContent.tsx** — New sections: header_media, roles, cv, partner_programs; destructure header_media, cv, partner_programs; SectionTitle text-primary; islandClass; wrap Proof, Featured, Skills, Achievements, Case studies, Links, Roles, CV, Partner programs, Reviews in island.
- **apps/web/src/app/api/public/profile/route.ts** — Payload type: header_media, cv, partner_programs.
- **apps/web/src/app/api/public/cv/[username]/route.ts** — New: GET redirect to signed CV URL (published profiles only).
- **apps/web/src/lib/publicLayoutPresets.ts** — SECTION_KEYS + header_media, roles, cv, partner_programs; LEFT_COLUMN_KEYS + header_media; RIGHT_COLUMN_KEYS + roles, cv, partner_programs; PRESET_DEFAULT_ORDER updated for all presets.
- **apps/web/src/figma/app/App.tsx** — ProfilePage: "Public preview" tab; when selected, render iframe of /[username] or message if no slug; hide dashboard grid when tab is publicPreview.
- **docs/PROFILE_MAPPING_MATRIX.md** — Matrix and mismatch summary updated; fixes applied; QA checklist extended.
- **docs/LAUNCH_P10_2_PROFILE_AIRTIGHT.md** — This file.

---

## QA checklist

- [ ] /profile → Public preview tab shows iframe of /[username]; layout, order, hidden, featured match after save and refresh.
- [ ] Builder section order/visibility changes reflect in Public preview and on /[username].
- [ ] Header media (image or video) appears on public page when set in Builder.
- [ ] CV section and "Download CV" link appear when profile has CV; link redirects to signed URL.
- [ ] Partner programs section shows cards when profile has partner programs.
- [ ] Roles section shows profession tags when profile has roles.
- [ ] Copy profile link copies canonical URL (e.g. https://linkary.xyz/username when NEXT_PUBLIC_APP_URL is set).
- [ ] Public page: section titles use primary color; major sections have island card style; mobile and desktop look correct.
- [ ] No builder setting is orphaned: all public Builder fields appear on /[username] or are explicitly internal-only.
