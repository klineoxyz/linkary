# Linkary.xyz Full-Stack Product Audit V1

Repo-grounded audit. Facts only; no guessing.

## Executive summary

| Category | Done | Partial | Missing |
|----------|------|---------|---------|
| Auth and identity | X OAuth, social_accounts, session sync, username claim, sync-handle | — | — |
| Profiles | Publish, case studies (incl. PATCH, proof_url sanitized on create), partner programs, reviews, 1-pager mapping, profile_socials, profile_media; profile editor supports case study edit | — | Skills, experience, CV upload |
| Orgs | Creation, profile fields, ecosystem, subsidiaries, partner_programs (org), reviews, token/dexscreener | — | — |
| Gigs / marketplace | Jobs, applications, apply flow, org invites, deals | — | REST API for conversations/messages |
| Public 1-pager | DTO allowlist, sanitizeUrl, ownership, cache, owner preview, HeroMedia, copy/share, brochure mode (?view=brochure) | — | — |
| Analytics and reputation | twitterapi.io, cron, snapshots, aggregates, init-status, ensure-backfill, Ethos, XScore, Linkary score | Source semantics (worker/partial/fallback) | Wallchain API not integrated |
| Production | ok/fail usage (health, partners, orgs, analytics, admin, ethos/score, xscore/score), rate limits, admin queue/smoke | Public profile API returns raw DTO (no ok wrapper); health does not probe rate_limits/cron | — |

## Feature-by-feature matrix

| Feature | Status | Where implemented | Gaps | Risks | Next action |
|---------|--------|-------------------|------|-------|-------------|
| X OAuth and social_accounts | Done | social_accounts migrations; api/auth/*, api/integrations/x/*; lib/xAuth.ts, xConnection.ts, socialAccounts.ts | — | — | — |
| Username claim | Done | api/onboarding/claim-username (claim_username_for_profile RPC); usernames table | — | — | — |
| twitter_username sync | Done | api/x/sync-handle; profiles.twitter_username read-only in editor | — | — | — |
| Profile skills | Missing | RolesSkillsPage placeholder only; UserProfilePage hardcoded array | No table or API | Low | Add profile_skills table + CRUD or defer |
| Profile experience | Missing | No table or UI | No table or API | Low | Defer or add experience table |
| CV upload | Missing | No table, storage, or API | New table + storage + RLS | Medium | Defer v1 |
| Case studies | Done | case_studies table; lib/caseStudies.ts (list/create; proof_url sanitized on create); api/case-studies/[id] PATCH; ProfileEditPage list/add/edit/delete; publicData + DTO | — | — | — |
| Partner programs | Done | partner_programs table; api/partners, api/partners/[id]; ProfileEditPage; publicData + DTO; RLS | — | — | — |
| Reviews (deal-linked) | Done | reviews.deal_id; deals table; RLS reviews only for completed deals (20260232000000) | — | — | — |
| Publish gating | Done | Editor checklist (avatar, bio, at least one link); public view only when published | — | — | — |
| 1-pager field mapping | Done | publicProfileDTO.ts allowlist; publicData entity builder; PublicOnePager | — | — | — |
| Socials SOT | Done | profile_socials table; ProfileEditPage upsert; publicData + DTO | — | — | — |
| Hero media SOT | Done | profile_media / org_media; ProfileEditPage upsert + sanitizeUrl; publicData + DTO; HeroMedia.tsx | — | — | — |
| Org creation | Done | api/orgs/create; RPC create_org_and_membership; company-only gate in migration/routes | — | — | — |
| Org partner programs | Done | partner_programs owner_type=org; same /api/partners; assertOwnership is_org_admin | — | — | — |
| Jobs and applications | Done | jobs, applications tables; api/orgs/[orgId]/jobs, api/applications/[id]/accept; lib/jobs.ts | — | — | — |
| Messaging | Partial | conversations, messages tables; lib/messages.ts; App apply flow + MessagesPage | No REST API for conversations/messages; client uses Supabase only | RLS must be correct for participants | Add read-only or minimal API if needed for support |
| Public DTO allowlist | Done | publicProfileDTO.ts; entityToPublicDTO; sanitizeUrl on all URLs | — | — | — |
| Ownership endpoint | Done | api/public/ownership?username= | — | — | — |
| Owner instant preview | Done | api/public/profile-owner/[username]; PublicOnePagerWrapper fetch + Refresh now | — | — | — |
| HeroMedia (YouTube/Vimeo/mp4/X) | Done | components/public/HeroMedia.tsx; type NONE/IMAGE/VIDEO | — | — | — |
| Brochure mode | Done | ?view=brochure on public page; PublicOnePager layout variant (no owner bar, no sticky CTA, Copy brochure link); same content as normal | — | — | — |
| Analytics cron and worker | Done | api/cron/*; worker xBackfill90d, sync_x_profiles_daily; x_daily_snapshots, x_window_aggregates | — | — | — |
| init-status / ensure-backfill | Done | api/analytics/init-status, ensure-backfill; rate limited | — | — | — |
| Ethos API | Done | api/ethos/score; ethos_scores table; public entity + linkaryScore | — | — | — |
| XScore (Wallchain) | Partial | profiles.xscore, orgs.xscore; api/xscore/score; xscoreProvider (abstraction) | No outbound Wallchain API; values stored only | Medium if score expected live | Document as manual/extension or integrate API |
| Linkary score | Done | lib/linkaryScore.ts; computed only; used in publicData, me-stats, OG | — | — | — |
| ok/fail wrapper | Done (key routes) | lib/api-response.ts; used in health, partners, orgs, analytics, admin, ethos/score, xscore/score | Public profile API returns raw DTO (intentionally unchanged) | — | — |
| Rate limits | Done | lib/rate-limit.ts; consume_rate_limit RPC; public profile, ensure-backfill, partners, orgs/create, etc. | — | — | — |
| Health and admin | Done | api/health; api/admin/queue-status; api/admin/smoke (superadmin) | Health does not check rate_limits RPC or cron | Low | Optional: extend health checks |

## Detailed findings

### A) Auth and identity

- **Tables:** `social_accounts` (user_id, provider, provider_user_id, username, status, revoked_at, etc.). Migrations: 20260228000000, 20260240000000, 20260241000000, 20260242000000, 20260245000000.
- **Routes:** `api/x/sync-handle` (POST), `api/auth/sync-session-x`, `api/auth/ensure-social-x`, `api/auth/ensure-social-from-profile`, `api/auth/persist-social`, `api/auth/post-login-bootstrap`, `api/integrations/x/claim`, `api/integrations/x/link/finish`, `api/integrations/x/disconnect`, `api/auth/social-x`, `api/onboarding/claim-username`, `api/debug/x-connection`.
- **Username:** Claim via RPC `claim_username_for_profile`; single source of truth `profiles.username` / `usernames` table. `twitter_username` is read-only in profile editor; updated via sync-handle from social_accounts.

### B) Profiles (users)

- **Tables:** `profiles`, `profile_socials`, `profile_media`, `case_studies`, `partner_programs`, `reviews` (reviewee_type=profile).
- **Case studies:** Schema in 20260218000000 (owner_type, owner_profile_id, title, description, proof_url, metrics). List/create in `lib/caseStudies.ts` (proof_url sanitized on create via sanitizeUrl); PATCH in `api/case-studies/[id]` (ownership check; title, description, proof_url). ProfileEditPage: list, add (modal), edit (modal), delete. Public DTO allowlist: id, title, description, proof_url, created_at; proof_url sanitized in DTO and on create/PATCH.
- **Partner programs:** Full CRUD via `/api/partners`, `/api/partners/[id]`; RLS and ownership checks; ProfileEditPage tabs, list, add/edit modal, reorder, featured.
- **Reviews:** `api/reviews` POST; reviews.deal_id; RLS in 20260232000000 restricts to completed deals.
- **Publish rules:** Avatar, bio, at least one link (website or any profile_socials URL); editor blocks publish and shows checklist.
- **1-pager mapping:** See publicProfileDTO.ts and PUBLIC_PROFILE_EDITING.md. All fields from profiles (via public_profile_view), profile_socials, profile_media, partner_programs, case_studies, reviews.

### C) Orgs

- **Tables:** `orgs` (slug, name, tagline, website, twitter_username, logo_url, org_type, parent_org_id, is_crypto_project, has_token, token_symbol, dexscreener_url, xscore), `org_members`, `org_relationships` (SUBSIDIARY/ECOSYSTEM/BRAND), `org_ecosystem_categories`, `org_media`, `partner_programs` (owner_type=org), `reviews` (reviewee_type=org).
- **Creation:** `api/orgs/create`; RPC create_org_and_membership; company-only gate. Token/dexscreener: org columns; public 1-pager shows when has_token / is_crypto_project.

### D) Gigs and messaging

- **Tables:** `jobs`, `applications`, `conversations` (participants jsonb), `messages`, `deals`.
- **Routes:** `api/orgs/[orgId]/jobs`, `api/orgs/[orgId]/jobs/[jobId]`, `api/applications/[id]/accept`. No `/api/conversations` or `/api/messages`; all via `lib/messages.ts` and Supabase client.
- **Apply flow:** App.tsx apply modal; create/fetch conversation and send first message. Org member invite: `api/orgs/[orgId]/members/invite`.

### E) Public 1-pager

- **DTO:** publicProfileDTO.ts; allowlist only; sanitizeUrl on avatar, website, socials, proof_url, logo_url, header_media_url, dexscreenerUrl.
- **Routes:** `api/public/profile/[username]` (cached), `api/public/profile-owner/[username]` (no-store, owner), `api/public/ownership?username=`, `api/public/layout`.
- **HeroMedia:** components/public/HeroMedia.tsx; YouTube, Vimeo, mp4/webm, X embed.
- **Partners/case studies/reviews:** Ordered (featured first for partners); shown in PublicOnePager sections. Copy link and Share on X present; no ?view=brochure.

### F) Analytics and reputation

- **Tables:** `x_daily_snapshots`, `x_window_aggregates`, `analytics_jobs`, `ethos_scores`; `profiles.xscore`, `orgs.xscore`.
- **twitterapi.io:** api/x-sync (user info); worker and lib use TWITTERAPI_BASE.
- **Cron:** api/cron/x-analytics-daily, sync-x-profiles-daily, backfill-x-90d-batch, sync-x-tweets-weekly.
- **Routes:** api/analytics/init-status, ensure-backfill, x, x/summary. Source semantics: worker/partial/fallback in getAnalyticsMeta; banner UX uses them.
- **Ethos:** api/ethos/score; cached in ethos_scores; used in public entity and linkaryScore.
- **XScore:** Stored only; no Wallchain API in repo. Linkary score: lib/linkaryScore.ts; computed; not stored.

### G) Production hardening

- **ok/fail:** lib/api-response.ts; used in health, partners, orgs/create, analytics ensure-backfill, admin smoke, queue-status, ethos/score, xscore/score. Public profile API returns raw DTO on 200; ethos and xscore use ok/fail.
- **Rate limits:** rate_limits table; consume_rate_limit RPC; applied to public profile, ensure-backfill, partners, orgs/create, invite, etc.
- **Health:** api/health; optional DB ping; no rate_limits or cron check.
- **Admin:** api/admin/queue-status (analytics_jobs), api/admin/smoke; superadmin only.

## Recommended next sprint (max 10 items)

1. **Case study proof_url sanitization:** In `lib/caseStudies.ts` createCaseStudyForProfile and createCaseStudyForOrg, sanitize proof_url with sanitizeUrl before insert. Risk: low.
2. **Case study PATCH API:** Add PATCH route for case_studies (e.g. api/case-studies/[id] or under profile) for title, description, proof_url; ownership check; sanitizeUrl. Risk: low.
3. **Brochure mode:** Add ?view=brochure to public page; optional layout variant (hide nav, sticky bar; cleaner spacing). Risk: low.
4. **Standardize API responses:** Use ok/fail in api/public/profile (optional), api/ethos/score, api/xscore/score for consistency. Risk: low.
5. **Health checks:** Optionally extend api/health to verify rate_limits RPC and one cron endpoint. Risk: low.
6. **Document XScore source:** In docs or code comment, state that profiles.xscore/orgs.xscore are set manually or via extension until Wallchain API is integrated. Risk: low.
7. **Conversations/messages API (optional):** If support or mobile need it, add minimal GET api/conversations, GET api/conversations/[id]/messages with auth and RLS. Risk: medium.
8. **Skills/experience:** Defer or add profile_skills table + CRUD and wire RolesSkillsPage. Risk: medium if new tables.
9. **CV upload:** Defer v1; would need storage bucket, RLS, and allowed types. Risk: high for v1.
10. **Regression checklist:** Run through: publish gating, owner preview, partner CRUD, case study add/delete, public DTO fields, rate limits on partners and public profile.

## Regression checklist (what to test)

See **docs/REGRESSION_CHECKLIST_V1.md** for the full list, including:

- Auth, profile editor (including case study edit), public 1-pager, orgs, analytics, production.
- Case studies: invalid proof_url stored as null; edit as owner (PATCH); non-owner gets 403.
- Cache copy: "Public updates can take up to 60 seconds for others. While logged in, you see instant preview."
- XScore label on public 1-pager: "Stored value (manual until Wallchain sync)."
- **Messaging permission tests:** User A and User B have a conversation; User C (non-participant) cannot read the conversation, cannot read messages, cannot insert a message. SQL snippets and step-by-step UI tests are in REGRESSION_CHECKLIST_V1.md. RLS policies in `20260218000000_mvp_orgs_reputation_marketplace.sql` enforce participants-only SELECT and sender-only INSERT; no migration was required.
