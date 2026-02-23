# V1 Shipping Roadmap

Converted from PLATFORM_AUDIT_V1.md. Phased plan to ship Linkary v1 with minimal regressions.

**Constraints:** Do not break existing auth, analytics worker, or public 1-pager. Prefer additive migrations and backward-compatible API changes. New public fields must be allowlist-only and sanitized. Every phase includes a test checklist.

---

## Phase 0: Critical fixes (security, RLS, schema consistency)

**Goal:** Fix security gaps and schema/sanitization inconsistencies before adding features.

**Scope:**
- Sanitize `proof_url` on case study create in `lib/caseStudies.ts` (createCaseStudyForProfile, createCaseStudyForOrg).
- Confirm RLS on `case_studies` is correct (select: public or owner; insert/update/delete: owner only). No change if already correct.
- Confirm no public DTO or API leaks internal ids except `case_studies.id` as documented.
- Document XScore source (profiles.xscore / orgs.xscore stored; Wallchain API not integrated).

**Migrations needed:** None.

**API routes:** None.

**UI pages:** None.

**Risks:** Low. Sanitization is additive; no breaking change.

**Validation checklist:**
- Create case study with invalid proof_url; expect null or rejected.
- Create case study with valid https URL; expect stored and shown on 1-pager.
- Verify case_studies RLS: anon cannot insert; owner can CRUD.
- Read docs for XScore; confirm no promise of live Wallchain API.

---

## Phase 1: Core brochure (profile editor parity + 1-pager completeness)

**Goal:** Complete profile editor parity and 1-pager behavior so brochure is reliable and editable.

**Scope:**
- Add PATCH API for case studies (title, description, proof_url; ownership check; sanitizeUrl on proof_url). Route: e.g. `PATCH /api/case-studies/[id]` or `PATCH /api/profile/case-studies/[id]`.
- Add brochure mode: `?view=brochure` on public page; layout variant (hide nav, hide sticky bar, cleaner spacing); optional "Copy brochure link" button.
- Optionally add "Edit" for case studies in ProfileEditPage that calls PATCH (if not already present).
- Standardize API responses: use ok/fail in ethos/score and xscore/score for consistency.

**Migrations needed:** None.

**API routes:** New PATCH for case-studies/[id]. Optional: GET case-studies for profile (if not already covered by existing load).

**UI pages:** ProfileEditPage (case study edit if added). Public page (brochure layout when view=brochure). PublicOnePagerWrapper or PublicOnePager (brochure variant).

**Risks:** Low. Additive; brochure mode is optional query param.

**Validation checklist:**
- PATCH case study as owner; verify 200 and updated data on 1-pager.
- PATCH case study as non-owner; verify 403.
- Open /[username]?view=brochure; verify layout differs (no nav/sticky, cleaner).
- Copy brochure link; open in incognito; verify same view.
- Ethos and xscore routes return ok/fail shape where applicable.

---

## Phase 2: Gigs marketplace complete (apply, requests, messaging, proof requirements)

**Goal:** Harden apply flow, optional proof requirements, and messaging visibility.

**Scope:**
- Optional: Require or encourage 1–2 case studies when applying to a job (UI + validation).
- Optional: Minimal REST API for conversations/messages (GET list, GET messages) for support or future clients; auth and participant RLS only.
- Document who can see applicants and who can message whom; verify RLS for conversations and messages.
- "Share profile with case studies when applying" behavior: confirm current apply flow attaches or links profile; document or add explicit "attach case studies" picker if needed.

**Migrations needed:** None unless adding application_case_studies link table (optional).

**API routes:** Optional GET /api/conversations, GET /api/conversations/[id]/messages.

**UI pages:** Apply modal (case study picker if added). MessagesPage (already exists; no change unless API added).

**Risks:** Medium if new API; low if documentation and RLS audit only.

**Validation checklist:**
- Apply to job; verify application and deal flow unchanged.
- As org, view applications; verify only org members with permission see them.
- If messaging API added: GET as participant returns messages; GET as non-participant returns 403.

---

## Phase 3: Reputation engine (Ethos + XScore + Linkary score)

**Goal:** Transparency and correctness of reputation signals.

**Scope:**
- Ethos: already integrated; ensure caching and error handling are robust; document cache TTL and userkey format.
- XScore: document that values are stored; no Wallchain API yet; optional: add admin or internal job to refresh xscore from Wallchain when API available.
- Linkary score: already computed; optional: add "How this score is calculated" collapsible on public 1-pager (signals used, no magic).
- Ensure reputation signals (ETHOS, XScore, Linkary) on 1-pager use thresholds and allowlist only; no regression.

**Migrations needed:** None unless adding xscore refresh job or cache table.

**API routes:** None required. Optional: internal or admin endpoint to trigger xscore refresh.

**UI pages:** Public 1-pager (optional "How this score is calculated" block).

**Risks:** Low. Mostly documentation and optional UX.

**Validation checklist:**
- Public 1-pager shows ETHOS, XScore, Linkary when data present; thresholds and primary color rules unchanged.
- Ethos cache: repeat request for same userkey; verify no unnecessary external call.
- Document reputation inputs and formula in docs or in-app copy.

---

## Phase 4: Standout features (differentiation)

**Goal:** Brochure export, proof-first application pack, verified collaboration badges.

**Scope:**
- Brochure: already have ?view=brochure in Phase 1; optional "Export PDF" (client-side or server-side) later.
- Proof-first application pack: when applying, user selects 2–4 case studies; generate shareable "Application Pack" link (read-only page: bio + socials + selected proof + reputation). Requires new route and optional storage for pack id.
- Verified collaboration badge: on 1-pager or profile, show "Collaboration verified" when deal completed and both sides reviewed (or admin verified). Use existing deals and reviews data.
- Partner programs: already have Featured and Since date; optional "proof link" (campaign page, tweet) as optional field on partner_programs and DTO.

**Migrations needed:** Optional: application_packs or pack_snapshots table; optional proof_link on partner_programs.

**API routes:** Optional: GET /api/pack/[id] for application pack view. Optional: PATCH partner_programs to add proof_link.

**UI pages:** Apply flow (case study selector + "Create application pack"). Public pack view. Public 1-pager (verified badge). Partner editor (proof link field).

**Risks:** Medium. New surfaces; keep allowlist and sanitization.

**Validation checklist:**
- Create application pack; open pack link; verify read-only and correct data.
- Complete deal and reviews; verify badge appears where expected.
- Add partner proof link; verify sanitized and shown on 1-pager.

---

## Cursor Master Prompt: Phase 0 + Phase 1 combined

Use this single prompt to execute Phase 0 and Phase 1 together in one pass. Keep changes minimal and backward-compatible.

```
CURSOR EXECUTION PROMPT: Phase 0 + Phase 1 – Critical fixes and core brochure

Goal
1) Phase 0: Sanitize case study proof_url on create; document XScore source.
2) Phase 1: Add case study PATCH API; add brochure mode (?view=brochure); standardize ethos and xscore API responses with ok/fail.

Rules
- Do not change auth, analytics worker, or public DTO contract beyond adding optional brochure layout.
- All new or touched API responses use ok/fail from @/lib/api-response where appropriate.
- All URL inputs (proof_url, etc.) must pass through sanitizeUrl before persist.

Tasks

1) Case study proof_url sanitization
- File: apps/web/src/lib/caseStudies.ts
- In createCaseStudyForProfile and createCaseStudyForOrg: import sanitizeUrl from @/lib/sanitizeUrl; before insert set proof_url to sanitizeUrl(payload.proof_url?.trim() || null) ?? null (or equivalent). Do not insert raw proof_url.

2) XScore source documentation
- Add to docs/PLATFORM_AUDIT_V1.md or create docs/XSCORE_SOURCE.md: one short paragraph stating profiles.xscore and orgs.xscore are stored values; Wallchain API is not integrated in this repo; values may be set manually or via external process.

3) Case study PATCH API
- Create PATCH handler at apps/web/src/app/api/case-studies/[id]/route.ts (or under profile scope if you prefer).
- Auth required. Load case_studies row by id. Verify ownership: profile owner for owner_profile_id, or org admin for owner_org_id (use existing is_org_admin or RLS).
- Allow updating only: title, description, proof_url. Sanitize proof_url with sanitizeUrl. Return updated row with ok().

4) Brochure mode
- In public username page (apps/web/src/app/(public)/[username]/page.tsx or equivalent), read searchParams.view === 'brochure'.
- Pass brochure={true} or view="brochure" to PublicOnePagerWrapper or PublicOnePager.
- In PublicOnePagerWrapper or PublicOnePager: when brochure, hide nav and sticky CTA bar; apply cleaner spacing; add "Copy brochure link" button that copies current URL (with ?view=brochure). Do not change DTO or data fetch.

5) Standardize ethos and xscore responses
- In apps/web/src/app/api/ethos/score/route.ts: on success return ok({ ... }) and on error return fail(...) from @/lib/api-response.
- In apps/web/src/app/api/xscore/score/route.ts: on success return ok({ ... }) and on error return fail(...).

Validation
- Create case study with http://evil.com; expect proof_url stored as null or rejected.
- PATCH case study as owner; expect 200 and updated data.
- Open /[username]?view=brochure; expect different layout and "Copy brochure link".
- GET ethos/score and xscore/score; expect { ok: true, ... } or { ok: false, code, message }.
```

---

**Order of execution:** Phase 0 then Phase 1 (or combined via master prompt above). Then Phase 2, 3, 4 as capacity allows. After each phase, run the phase validation checklist before moving on.
