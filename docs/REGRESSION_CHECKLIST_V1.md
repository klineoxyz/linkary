# V1 Regression checklist

Use this checklist before shipping. Includes explicit messaging permission tests.

## General

- Auth: X link and disconnect; sync-handle; username claim; post-login bootstrap.
- Profile editor: Save basics (display_name, bio, website, location); save socials and hero media; add/edit/delete/reorder partner programs; add/delete case studies; **edit case study** (PATCH); publish toggle and gating checklist.
- Public 1-pager: Load as anon (cached); load as owner (instant + Refresh now); verify socials, hero media, partners (featured order), case studies, reviews; copy link and Share on X.
- Orgs: Create org; add job; receive application; accept application (deal); org partner programs; org public page.
- Analytics: ensure-backfill as owner; init-status; cron runs (or manual trigger); worker backfill; 90d window aggregates.
- Production: GET api/health; admin queue-status and smoke (as superadmin); rate limit triggers (e.g. partners 30/10min).

## Case studies

- Create case study with invalid proof_url (e.g. `javascript:alert(1)`); expect stored as null and public page does not break.
- Create case study with valid https URL; expect persisted and shown on public page.
- Edit case study as owner via profile editor; expect PATCH succeeds and list/owner preview updates.
- Edit case study as non-owner (e.g. different user); expect 403 or fail with clear code.

## Cache and copy

- Owner sees "Public updates can take up to 60 seconds for others. While logged in, you see instant preview." in profile editor.
- Owner preview endpoint returns no-store; public profile endpoint keeps s-maxage/stale-while-revalidate.

## XScore

- Public 1-pager shows small label under XScore: "Stored value (manual until Wallchain sync)" (profile and org cards).

## Messaging permission tests

RLS policies (from `supabase/migrations/20260218000000_mvp_orgs_reputation_marketplace.sql`):

- **conversations:** `conversations_select_participant` allows SELECT only if `participants` contains current user (as profile id or as org member of an org in participants). `conversations_insert_authed` allows INSERT for any authenticated user (conversation creation).
- **messages:** `messages_select_conversation` allows SELECT only if the conversation’s participants include the current user. `messages_insert_sender` allows INSERT only when sender is current user (profile) or current user is org admin for sender org.

**Manual test (UI):**

1. User A and User B have a conversation (e.g. via apply flow or messages).
2. As User C (not a participant), open app and go to messages or any path that lists conversations.
3. User C must not see the conversation between A and B.
4. User C must not be able to read messages in that conversation.
5. User C must not be able to send a message into that conversation.

**SQL checks (Supabase SQL editor):**

Run as **anon** (no auth):

```sql
-- Should return 0 rows (anon cannot see any conversations)
SET request.jwt.claim.sub = NULL;
SELECT * FROM conversations LIMIT 1;
```

Run as **User A** (set JWT to A’s user id) where A is participant in conversation `conv_id`:

```sql
-- As User A: should see only conversations where A is participant
SELECT id, participants FROM conversations;
-- Expect rows where participants contains { "type": "profile", "id": "<A's uuid>" } or A's org.
```

Run as **User C** (not participant in `conv_id`):

```sql
-- As User C: should not see conversation conv_id
SELECT * FROM conversations WHERE id = '<conv_id>';
-- Expect 0 rows.
```

Step-by-step in UI:

1. Log in as User A. Create or open a conversation with User B (e.g. apply to a job as A, org accepts, conversation exists).
2. Log out. Log in as User C (different account, not in that conversation).
3. Open Messages (or equivalent). Verify the A–B conversation does not appear in the list.
4. If you have a direct link to a conversation (e.g. /messages?conv=id), open it as User C. Verify you cannot see messages or see an empty/forbidden state.
5. Attempt to send a message as User C into that conversation (e.g. via API or UI if exposed). Verify 403 or RLS blocks insert.
