-- =============================================================================
-- Namespace remediation Option B: org keeps desicryptoclub.
-- Run once. See LINKARY_NAMESPACE_REMEDIATION_AND_BACKFILL_PLAN.md and
-- LINKARY_NAMESPACE_REMEDIATION_EXECUTION.md.
--
-- 1) Profile no longer uses desicryptoclub (placeholder username)
-- 2) Remove profile's claim from usernames if present
-- 3) Assign desicryptoclub to org in usernames; orgs.slug already = desicryptoclub
-- =============================================================================

BEGIN;

-- Option B: org keeps desicryptoclub. Profile ID and org ID from LINKARY_NAMESPACE_AUDIT_REPORT.md.

-- 1) Set profile to a unique placeholder username (deterministic from profile id)
UPDATE public.profiles
SET username = 'profile-dsc-ce3dbb39',
    updated_at = now()
WHERE id = 'ce3dbb39-5ff3-4712-bbd1-19cbd32583ed';

-- 2) Remove profile's claim on desicryptoclub from usernames (if present)
DELETE FROM public.usernames
WHERE username = 'desicryptoclub'
  AND owner_type = 'profile'
  AND owner_id = 'ce3dbb39-5ff3-4712-bbd1-19cbd32583ed';

-- 3) Ensure org owns desicryptoclub in usernames (orgs.slug is already desicryptoclub)
INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
VALUES ('desicryptoclub', 'org', '520af360-4196-4a41-94d3-523b0ae6c4cc', NULL, NULL)
ON CONFLICT (username) DO UPDATE
SET owner_type = 'org',
    owner_id = EXCLUDED.owner_id;

COMMIT;
