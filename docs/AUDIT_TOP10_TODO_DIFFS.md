# Top 10 Next Actions: Exact TODO Diffs

From PLATFORM_AUDIT_V1.md. File paths and function names; what to change.

---

1. **Case study proof_url sanitization on create**  
   - File: `apps/web/src/lib/caseStudies.ts`  
   - Functions: `createCaseStudyForProfile`, `createCaseStudyForOrg`  
   - Change: Import `sanitizeUrl` from `@/lib/sanitizeUrl`. Before insert, set `proof_url: payload.proof_url ? sanitizeUrl(payload.proof_url.trim()) ?? null : null` (or equivalent).  
   - Risk: Low.

2. **Case study PATCH API**  
   - New file: `apps/web/src/app/api/case-studies/[id]/route.ts` (or under profile scope).  
   - Add: PATCH handler; auth; load case_study by id; verify ownership (profile id or org admin); allow updating title, description, proof_url (sanitizeUrl for proof_url); update row and return.  
   - Risk: Low.

3. **Brochure mode query param**  
   - File: `apps/web/src/app/(public)/[username]/page.tsx` (or equivalent).  
   - Change: Read `searchParams.view === 'brochure'`; pass to PublicOnePagerWrapper or layout.  
   - File: `apps/web/src/app/(public)/[username]/PublicOnePagerWrapper.tsx` or `PublicOnePager.tsx`.  
   - Change: When brochure mode, apply layout variant (e.g. hide nav, sticky bar; increase spacing; optional “Copy brochure link” button).  
   - Risk: Low.

4. **Standardize public profile API response**  
   - File: `apps/web/src/app/api/public/profile/[username]/route.ts`.  
   - Change: Optionally wrap 200 body in `ok(result.dto)` and keep 404 as-is; or leave as-is and only document.  
   - Risk: Low.

5. **Standardize ethos/score response**  
   - File: `apps/web/src/app/api/ethos/score/route.ts`.  
   - Change: Use `ok({ ... })` and `fail(...)` from `@/lib/api-response` for success and error responses.  
   - Risk: Low.

6. **Standardize xscore/score response**  
   - File: `apps/web/src/app/api/xscore/score/route.ts`.  
   - Change: Use `ok({ ... })` and `fail(...)` from `@/lib/api-response`.  
   - Risk: Low.

7. **Health check extensions (optional)**  
   - File: `apps/web/src/app/api/health/route.ts`.  
   - Change: Optionally call `consume_rate_limit` with a test key and expect allowed; optionally call one cron route with CRON_SECRET and expect 200. Do not fail health if optional checks fail; or add a separate “readiness” endpoint.  
   - Risk: Low.

8. **Document XScore source**  
   - File: `docs/PLATFORM_AUDIT_V1.md` or `docs/PUBLIC_PROFILE_EDITING.md` or new `docs/XSCORE_SOURCE.md`.  
   - Change: Add short note that `profiles.xscore` and `orgs.xscore` are stored values; Wallchain API is not integrated; values can be set manually or via extension until integration.  
   - Risk: Low.

9. **Conversations/messages API (optional)**  
   - New file: `apps/web/src/app/api/conversations/route.ts` (GET list for current user).  
   - New file: `apps/web/src/app/api/conversations/[id]/messages/route.ts` (GET messages for conversation; auth + participant check).  
   - Use existing RLS; return only allowlisted fields.  
   - Risk: Medium.

10. **Regression checklist automation**  
    - File: `docs/PLATFORM_AUDIT_V1.md` (or new `docs/REGRESSION_CHECKLIST.md`).  
    - Change: Turn “Regression checklist” section into a step-by-step manual test list or link to a Playwright/Cypress plan.  
    - Risk: Low.

---

**Priority order for v1:** 1 → 2 → 3 (sanitization, PATCH, brochure). Then 4–6 (response consistency), then 8 (docs). 7, 9, 10 as capacity allows.
