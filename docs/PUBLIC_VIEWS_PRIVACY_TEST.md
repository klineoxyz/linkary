# Public Views Privacy — Changes & Manual Test List

## Migration

- **File:** `supabase/migrations/20260234000000_public_views_privacy.sql`
- Adds `profiles.analytics_visibility` (default `'public'`) with check `('public','private')`.
- Adds `orgs.published` (default `false`).
- Recreates `public_profile_view` with analytics fields gated by `analytics_visibility` (CASE → NULL when private).
- Recreates `public_org_view` with `WHERE o.published = true` and slug/name not empty.
- Grants SELECT to anon on both views.
- Indexes: `idx_profiles_published`, `idx_profiles_analytics_visibility`, `idx_orgs_published`.

**Apply:** `pnpm db:push` (or run migrations in Supabase).

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20260234000000_public_views_privacy.sql` | New migration (columns + views + indexes). |
| `apps/web/src/lib/profiles.ts` | Added `analytics_visibility` to Profile type and `updateMyProfile` payload; map in `getMyProfile`. |
| `apps/web/src/lib/orgs.ts` | Added `published` and `public_layout` to Org type; added `published` to `updateOrg` payload. |
| `apps/web/src/figma/app/components/PrivacyDataPage.tsx` | Load profile by `userId`; "Public analytics" toggle writes `profiles.analytics_visibility`; accepts `userId` and `refreshMe`. |
| `apps/web/src/figma/app/App.tsx` | Pass `userId={authUserId}` and `refreshMe={refreshMe}` to `PrivacyDataPage`. |
| `apps/web/src/figma/app/components/OrgDetailPage.tsx` | Added `published` state; "Public listing" toggle in Settings; save includes `published` in `updateOrg`. |

**APIs:** `/api/search` and `/api/landing/featured` already use the views; no code changes. They will naturally return only published orgs and profiles; profile analytics (e.g. xscore) may be null when `analytics_visibility = 'private'`.

---

## Manual Test List (5 items)

1. **Migration**
   - Run `pnpm db:push`. In Supabase SQL editor, run `SELECT * FROM public.public_profile_view LIMIT 1` and `SELECT * FROM public.public_org_view LIMIT 1`. No errors; views return rows only for published profiles / published orgs.

2. **Profile — Public analytics**
   - Log in, go to Privacy & Data. Toggle "Public analytics" off → save; reload page → toggle stays off. Toggle on → save; reload → stays on. Visit your public profile URL; with "Public analytics" on, metrics (e.g. XScore) visible; with off, they should be hidden (or null) when read from the public view.

3. **Org — Public listing**
   - As org owner/admin, open org → Settings. Enable "Show this org on Linkary search and landing", click Save. Call `GET /api/landing/featured` and search; org appears. Disable the toggle, Save; org no longer appears in featured or search.

4. **Search**
   - `GET /api/search?q=...` returns only profiles with `published = true` and orgs with `published = true`. Unpublished orgs never appear.

5. **Landing featured**
   - `GET /api/landing/featured` returns only from `public_profile_view` and `public_org_view`. After turning off org "Public listing", that org disappears from featured. Profile `xscore` may be null when "Public analytics" is private; UI/API should handle null.

---

## Post-merge

- Set `published = true` for any orgs you want visible on landing/search (e.g. via Supabase or a one-off script).
- Org settings "Public listing" toggle lets owners control it going forward.
