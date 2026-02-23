# Linkary V1 Feature Matrix

Matrix view of feature status. See PLATFORM_AUDIT_V1.md for paths and details.

| Feature | Status | DB / Tables | API Routes | UI / Components | Gaps | Risk |
|---------|--------|-------------|------------|-----------------|------|------|
| X OAuth and social_accounts | Done | social_accounts | auth/*, integrations/x/*, x/sync-handle | Settings, post-login | — | — |
| Username claim | Done | usernames, profiles | onboarding/claim-username | Onboarding | — | — |
| twitter_username sync | Done | profiles, social_accounts | x/sync-handle | Profile edit (read-only) | — | — |
| Profile skills | Missing | — | — | RolesSkillsPage (placeholder) | No table/API | Low |
| Profile experience | Missing | — | — | — | No table/API | Low |
| CV upload | Missing | — | — | — | Table + storage + RLS | Medium |
| Case studies | Partial | case_studies | — (lib only) | ProfileEditPage, OrgDetailPage | No PATCH; proof_url not sanitized on create | Low |
| Partner programs | Done | partner_programs | GET/POST /api/partners, PATCH/DELETE [id] | ProfileEditPage tabs, modal, list | — | — |
| Reviews (deal-linked) | Done | reviews, deals | POST /api/reviews | Public 1-pager, deal flow | — | — |
| Publish gating | Done | profiles.published | — | ProfileEditPage checklist | — | — |
| 1-pager field mapping | Done | public_profile_view, profile_socials, profile_media, etc. | public/profile/[username], profile-owner | PublicOnePager | — | — |
| Socials SOT | Done | profile_socials | — (editor upsert) | ProfileEditPage | — | — |
| Hero media SOT | Done | profile_media, org_media | — (editor upsert) | ProfileEditPage, HeroMedia | — | — |
| Org creation | Done | orgs, org_members | POST /api/orgs/create | Org create flow | — | — |
| Org profile and partners | Done | orgs, partner_programs | /api/partners (owner_type=org) | OrgDetailPage | — | — |
| Jobs and applications | Done | jobs, applications | orgs/[orgId]/jobs, applications/[id]/accept | App, OrgDetailPage | — | — |
| Messaging | Partial | conversations, messages | — | lib/messages.ts, App, MessagesPage | No REST API | Medium |
| Public DTO allowlist | Done | — | public/profile, profile-owner | publicProfileDTO.ts | — | — |
| Ownership and owner preview | Done | — | public/ownership, profile-owner | PublicOnePagerWrapper | — | — |
| HeroMedia (video/image) | Done | — | — | HeroMedia.tsx | — | — |
| Brochure mode | Missing | — | — | — | No ?view=brochure | Low |
| Analytics cron and worker | Done | x_daily_snapshots, x_window_aggregates, analytics_jobs | cron/*, analytics/* | — | — | — |
| init-status / ensure-backfill | Done | — | analytics/init-status, ensure-backfill | Banner, owner flow | — | — |
| Ethos API | Done | ethos_scores | ethos/score | public entity, linkaryScore | — | — |
| XScore | Partial | profiles.xscore, orgs.xscore | xscore/score | Public 1-pager, me-stats | No Wallchain API | Medium |
| Linkary score | Done | — | — | linkaryScore.ts, publicData | — | — |
| ok/fail and rate limits | Partial | rate_limits | — | Many routes | Inconsistent ok/fail; health does not probe rate_limits | Low |
| Health and admin | Done | — | health, admin/queue-status, admin/smoke | — | — | — |

**Legend:** Done = implemented and wired. Partial = implemented with gaps. Missing = not implemented.

**Required for missing/partial:**  
- New table/migration: case_studies PATCH (no new table); skills/experience/CV (new tables).  
- New API: case-studies PATCH; optional conversations/messages GET.  
- UI only: brochure mode; RolesSkillsPage when skills table exists.  
- Policy/RLS: case_studies already has RLS; CV would need storage RLS.
