# Linkary — Recommended Next Audits

**Date:** 2026-03-10  
**Purpose:** Prioritized list of audits that are useful **now** given current product state and prior audits.

---

## 1. Security / RLS Audit

**Why now:** Multiple tables (profiles, orgs, org_members, deals, gig_deals, case_studies, applications, gig_applications, partner_programs, watchlists, analytics-related) have RLS; `orgs.owner_profile_id` references `auth.users(id)` in at least one migration — need to confirm alignment with profile id and no privilege escalation.

**Questions to answer:**
- Do all RLS policies match intended “owner/admin/member” semantics?
- Can anon or a low-privilege user read/write any row they shouldn’t?
- Is `owner_profile_id` consistently used (and correct) for org ownership and gig/deal ownership?
- Are service-role-only paths (e.g. analytics cache tables) never exposed to client?

**Recommended order:** 1 (high impact before scale).

---

## 2. Permissions Audit

**Why now:** Two job systems (org jobs vs gigs), two deal types (deals vs gig_deals), profile vs org ownership, and invite flows (affiliates/ambassadors) — worth a single “who can do what” map.

**Questions to answer:**
- Who can create/edit/close org jobs vs gigs? Accept/reject applications? Complete deals? Create reviews?
- Who can invite/remove affiliates and ambassadors? Who can accept?
- Who can add/edit/delete case studies (profile vs org)?
- Are there any actions allowed by UI but not enforced in API/RLS?

**Recommended order:** 2.

---

## 3. Migration Integrity Audit

**Why now:** Many migrations (50+); prod schema may have drifted; LAUNCH_READINESS_AUDIT mentioned “migration may not match prod.”

**Questions to answer:**
- Does applying all migrations from a clean DB produce the same schema and RLS as production?
- Any missing indexes or constraints that could cause bugs or performance issues?
- Any duplicate or conflicting policies (e.g. same policy name dropped and recreated in different migrations)?

**Recommended order:** 3.

---

## 4. Public / Private Visibility Audit

**Why now:** Public profile, public org, case studies, partner programs, gigs, and analytics/social insights have different visibility rules; cross-user insights were called out in AUDIT_DATA_ARCHITECTURE.

**Questions to answer:**
- For each entity (profile, org, case study, gig, partner program, review), when is it visible to anon vs authenticated vs owner/admin?
- Does `/api/social/insights?username=` enforce profile visibility (e.g. published only)?
- Are there any routes or APIs that expose private data by default?

**Recommended order:** 4.

---

## 5. Analytics Trust Audit

**Why now:** Dashboard mixes mock and real data; Analytics page is real; Profile Insights duplicates. Users need to know what is “your data” vs “estimated” vs “not available.”

**Questions to answer:**
- Where is each metric sourced (DB, backfill, cache, external API)?
- Are empty/loading/error and “no data yet” states clear and consistent?
- Is “Last updated” or “Data as of” shown where it matters?
- Any labels that could imply accuracy (e.g. “real-time”) when data is cached?

**Recommended order:** 5.

---

## 6. Onboarding Audit

**Why now:** First-time creator and first-time org flows drive activation; gaps here hurt launch credibility.

**Questions to answer:**
- After signup, what is the minimal path to “profile looks complete” and “org is created and usable”?
- Are required steps (e.g. username, X connect) clear and validated?
- Any dead ends or missing CTAs (e.g. “Create your first gig” after org creation)?
- Is onboarding copy and flow consistent with permissions (e.g. “You’re the owner”)?

**Recommended order:** 6.

---

## 7. Jobs-to-Deal Conversion Audit

**Why now:** Two paths (org jobs → applications → deals; gigs → gig_applications → gig_deals); conversion and notifications matter for trust.

**Questions to answer:**
- From “job published” to “deal completed” and “review left,” what are the exact steps and APIs?
- Where can the flow break (e.g. missing “Complete deal” for org deals)?
- Are notifications sent at each step (application received, accepted, deal completed, review requested)?
- Is the difference between “org job” and “gig” clear in UI and docs?

**Recommended order:** 7.

---

## 8. Creator Program and Invite Audit

**Why now:** Affiliates/ambassadors and partner programs are implemented; worth confirming end-to-end and edge cases.

**Questions to answer:**
- Can an org invite by handle when the profile is not yet on Linkary? (Current: “Profile not found for that handle” — user must be registered.)
- Can a profile be both affiliate and ambassador for the same org? (Schema allows it.)
- Are partner_programs (profile/org) and org_affiliations/org_ambassadors consistently shown on public pages and in org dashboard?
- Any max limits (e.g. ambassadors per profile) and are they enforced in UI and API?

**Recommended order:** 8.

---

## 9. API Consistency Audit

**Why now:** Many API routes; consistent shapes and errors improve integration and debugging.

**Questions to answer:**
- Do JSON responses use a consistent shape (e.g. `{ data }` vs `{ ...fields }` vs `{ ok, deal }`)?
- Are 4xx/5xx bodies consistent (e.g. `code`, `message`, optional `resetAt` for rate limit)?
- Is pagination (if any) consistent (cursor vs offset, limit max)?
- Are auth errors (401/403) and validation errors (400) clearly distinguishable?

**Recommended order:** 9.

---

## 10. Performance Under Real Data Audit

**Why now:** Prior performance audit focused on bundle and duplicate fetch; not on “with 90d backfill and 100+ deals/case studies.”

**Questions to answer:**
- Do key pages (Dashboard, Analytics, Profile, Org detail) stay responsive with large datasets?
- Are lists (applications, deals, case studies, gigs) paginated or capped?
- Do any N+1 or heavy queries appear when loading org detail with many jobs/applications?
- Are Recharts and large tables virtualized or limited to a safe size?

**Recommended order:** 10 (after core correctness and security).

---

## Recommended Order (Summary)

| Order | Audit | Why first |
|-------|--------|-----------|
| 1 | Security / RLS | Prevents privilege escalation and data leaks. |
| 2 | Permissions | Clarifies product model and catches UI/API mismatches. |
| 3 | Migration integrity | Ensures prod and codebase stay in sync. |
| 4 | Public/private visibility | Trust and privacy. |
| 5 | Analytics trust | Reduces misleading metrics and confusion. |
| 6 | Onboarding | Improves activation and first impression. |
| 7 | Jobs-to-deal conversion | Ensures core loop is complete and clear. |
| 8 | Creator program and invite | Validates affiliate/ambassador flow end-to-end. |
| 9 | API consistency | Improves maintainability and integrations. |
| 10 | Performance under real data | Validates scale and UX with real usage. |

---

*End of LINKARY_NEXT_AUDITS_RECOMMENDATION.md*
