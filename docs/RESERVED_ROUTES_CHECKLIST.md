# Reserved routes checklist

When adding any **new top-level route** (e.g. a new page at `app/jobs/page.tsx` or `app/help/page.tsx`):

1. **Add the segment to the single source of truth**  
   Edit `apps/web/src/lib/reservedPaths.ts` and add the new path to `RESERVED_PATHS` (e.g. `"jobs"`, `"help"`). This ensures:
   - The slug page treats it as an app route (shows app shell, not a profile).
   - Claim flows never assign it as a user slug (safeSlug will add a suffix).

2. **Run the collision script**  
   From repo root:
   ```bash
   pnpm exec tsx apps/web/scripts/checkReservedCollisions.ts
   ```
   Or from `apps/web`:
   ```bash
   pnpm exec tsx scripts/checkReservedCollisions.ts
   ```
   If the script reports collisions (existing profiles/orgs with that slug), either:
   - Choose a different route name, or
   - Resolve collisions (e.g. migrate those users’ slugs or add a redirect) before shipping.

3. **Keep route lists in sync**  
   `App.tsx` imports `RESERVED_PATHS` from `@/lib/reservedPaths`; no duplicate set. When adding a new route, update the `nameMap` in `pathFromRoute` / `routeFromPathname` in `App.tsx` if the route is user-navigable.

4. **Optional: assert required paths**  
   Run `pnpm exec tsx apps/web/scripts/assertReservedPaths.ts` to ensure key reserved paths (app, api, auth, login, dashboard, etc.) are present.
