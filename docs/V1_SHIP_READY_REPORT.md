# V1 Ship ready report (final polish)

Summary of the final polish pack: brochure mode, API response consistency, and doc updates. No DTO or schema changes.

## Files changed

- `apps/web/src/app/(public)/[username]/page.tsx` — Read `searchParams.view`; pass `brochure={view === "brochure"}` to PublicOnePagerWrapper.
- `apps/web/src/app/(public)/[username]/PublicOnePagerWrapper.tsx` — Accept `brochure`; when brochure, hide owner "Refresh now" bar and pass `isOwner={false}` and `brochure={true}` to PublicOnePager.
- `apps/web/src/components/public/PublicOnePager.tsx` — Accept `brochure`; when brochure: sticky "Copy brochure link" button (copies URL with `?view=brochure`), hide owner-only block and StickyClaimBar, increase main padding (`py-8 sm:py-12`).
- `apps/web/src/app/api/ethos/score/route.ts` — Use `ok()` and `fail()` from `@/lib/api-response`; success body unchanged (score_value, score_json, etc.) so existing clients keep working.
- `apps/web/src/app/api/xscore/score/route.ts` — Use `ok()` and `fail()` from `@/lib/api-response`; success body unchanged (username, xscore).
- `docs/REGRESSION_CHECKLIST_V1.md` — Added brochure mode tests and API response tests (ethos, xscore, public profile note).
- `docs/PLATFORM_AUDIT_V1.md` — Updated case studies and brochure/ok-fail rows to reflect current state.
- `docs/V1_SHIP_READY_REPORT.md` — This file.

## How to test in ~10 minutes

1. **Brochure mode**
   - Open `https://your-domain.com/{username}` (normal). Confirm owner bar (if owner) and bottom sticky CTA (if non-owner) appear as before.
   - Open `https://your-domain.com/{username}?view=brochure`. Confirm: no owner bar, no sticky CTA, "Copy brochure link" top right. Click it; paste elsewhere and confirm URL ends with `?view=brochure`. Confirm content matches normal view.

2. **API response shape**
   - `GET /api/ethos/score?userkey=service:x.com:username:VALID_HANDLE` — Expect 200 and body with `ok: true` and `score_value` (or cached fields). Invalid userkey: 400 with `ok: false` and `code`, `message`.
   - `GET /api/xscore/score?username=VALID_HANDLE` — Expect 200 and body with `ok: true` and `xscore`. Missing username: 400 with `ok: false`.

3. **Regression**
   - Run through the first two sections of `docs/REGRESSION_CHECKLIST_V1.md` (General, Case studies, Cache and copy, XScore, Brochure mode, API response consistency). Spot-check messaging tests if you have multiple users.

4. **Build**
   - `npm run build` in `apps/web` must pass.

## Risks and follow-ups

- **Public profile API:** Not wrapped in `ok()` to avoid breaking any consumer that expects raw DTO. Documented in regression checklist.
- **Brochure:** Pure UI variant; no new API or DTO. If you add more owner-only UI later, keep guarding it with `!brochure` where appropriate.
- **Ethos/XScore clients:** publicData and me-stats already read `res.ok` and then payload fields; `ok({ ... })` keeps those fields on the response body, so no client changes were required.
