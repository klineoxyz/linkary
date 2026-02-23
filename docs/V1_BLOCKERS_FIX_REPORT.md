# V1 Blockers fix report

Summary of changes for the V1 Ship Blockers fix pack. No long dashes; bullet style only.

## 1) Case studies: sanitize proof_url on create

**What changed**
- `apps/web/src/lib/caseStudies.ts`: Import `sanitizeUrl` from `@/lib/sanitizeUrl`. In `createCaseStudyForProfile` and `createCaseStudyForOrg`, before insert: `const clean = payload.proof_url?.trim() ?? ""`; `const safeProofUrl = clean ? sanitizeUrl(clean) ?? null : null`; set `proof_url` to `safeProofUrl` (never raw input).

**How to test**
- Create a case study with proof_url `javascript:alert(1)` or `data:text/html,<script>`. Check DB: `proof_url` should be null. Public page should not break.
- Create a case study with proof_url `https://example.com/proof`. Check DB and public page: URL stored and displayed.

---

## 2) Case studies: PATCH API

**What changed**
- New file: `apps/web/src/app/api/case-studies/[id]/route.ts`. PATCH only. Auth required. Load `case_studies` by id; ownership: profile owner or org admin via `is_org_admin` RPC. Allowed body: `title`, `description`, `proof_url` (sanitized). Returns `ok({ caseStudy })` or `fail(...)` from `@/lib/api-response`.

**How to test**
- As owner, PATCH a case study (title, description, proof_url). Expect 200 and updated row. Reload profile editor and owner preview; changes visible.
- As non-owner, PATCH same id. Expect 403 and clear error code/message.

---

## 3) Profile editor: Edit case study

**What changed**
- `apps/web/src/figma/app/components/ProfileEditPage.tsx`:
  - `CaseStudiesEditor`: New prop `onOpenEditModal(cs: CaseStudy)`. Edit button per case study row; Delete unchanged.
  - `CaseStudyModal`: New optional prop `edit?: CaseStudy | null`. When `edit` is set, title "Edit case study", button "Update". Parent passes `editingCaseStudy` state and on submit calls PATCH `/api/case-studies/[id]` with auth headers, then refetches list and closes modal.
  - State: `editingCaseStudy: CaseStudy | null`. On "Add", clear edit and open modal; on "Edit", set `editingCaseStudy`, prefill form, open modal. On close, clear `editingCaseStudy`.

**How to test**
- Open profile edit, case studies section. Click Edit on a row; modal opens with title/description/proof URL prefilled. Change fields, click Update; list and owner preview update. Invalid proof URL in edit is sanitized (stored as null). On error, message shown (setError or toast).

---

## 4) XScore expectations: label + doc

**What changed**
- **UI:** `apps/web/src/components/public/PublicOnePager.tsx`. Under the XScore value (profile and org reputation cards), added one line: `Stored value (manual until Wallchain sync)` (text-[10px] text-muted-foreground).
- **Docs:** New `docs/XSCORE_SOURCE.md`. One short paragraph: profiles.xscore and orgs.xscore are stored values; Wallchain API not integrated in this repo; values may be set manually or via external worker.

**How to test**
- Open any public profile or org 1-pager. XScore card shows the new label under the value.

---

## 5) Public cache copy

**What changed**
- `apps/web/src/figma/app/components/ProfileEditPage.tsx`: Near Publish / Copy link / Open public page, text updated from "Public updates can take up to 1 minute to appear." to "Public updates can take up to 60 seconds for others. While logged in, you see instant preview."
- No change to owner endpoint (no-store) or public profile endpoint cache headers.

**How to test**
- In profile editor, confirm the new copy is visible. As owner, confirm instant preview (e.g. Refresh now) still works.

---

## 6) Messaging: RLS verification + regression checklist

**What changed**
- **RLS:** Verified in `supabase/migrations/20260218000000_mvp_orgs_reputation_marketplace.sql`. `conversations_select_participant`: SELECT only if user is in `participants`. `messages_select_conversation`: SELECT only if user is participant in the conversation. `messages_insert_sender`: INSERT only if sender is current user (profile) or org admin. No policy changes; no migration added.
- **Docs:** New `docs/REGRESSION_CHECKLIST_V1.md` with full regression list and **explicit messaging permission tests**: User A and B conversation; User C (non-participant) cannot read conversation, cannot read messages, cannot insert. Includes SQL snippets (anon vs authenticated, participant vs non-participant) and step-by-step UI test.
- **Docs:** `docs/PLATFORM_AUDIT_V1.md` regression section updated to point to REGRESSION_CHECKLIST_V1.md and to summarize messaging tests and RLS verification.

**How to test**
- Follow "Messaging permission tests" and "SQL checks" in docs/REGRESSION_CHECKLIST_V1.md. As User C, ensure no access to A–B conversation or messages.

---

## File paths touched

- `apps/web/src/lib/caseStudies.ts`
- `apps/web/src/app/api/case-studies/[id]/route.ts` (new)
- `apps/web/src/figma/app/components/ProfileEditPage.tsx`
- `apps/web/src/components/public/PublicOnePager.tsx`
- `docs/XSCORE_SOURCE.md` (new)
- `docs/REGRESSION_CHECKLIST_V1.md` (new)
- `docs/PLATFORM_AUDIT_V1.md`
- `docs/V1_BLOCKERS_FIX_REPORT.md` (this file)
