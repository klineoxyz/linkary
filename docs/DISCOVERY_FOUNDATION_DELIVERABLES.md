# Discovery Foundation — Deliverables

**Mission:** Build the safe server-side foundation for Linkary paid discovery/search without launching the full product. No redesign, no full search UI, no privacy regression.

---

## 1. Exact files changed / created

| File | Change |
|------|--------|
| `apps/web/src/lib/discoveryAllowlist.ts` | Added `type: "org"` to `DiscoveryOrgResult`, `type: "profile"` to mapper return; added `DISCOVERY_PROFILE_ALLOWED_FIELDS`, `DISCOVERY_FORBIDDEN_FIELDS`. |
| `apps/web/src/lib/entitlementDiscovery.ts` | **New.** `isEligibleForDiscovery(userId)`: stub returning `true` only when `LINKARY_DISCOVERY_ELIGIBLE=true`. |
| `apps/web/src/lib/discoveryService.ts` | **New.** Server-side discovery: `getDiscoveryProfiles(client, options)`, `getDiscoveryOrgs(client, options)` with explicit allowlisted columns from `public_profile_view` / `public_org_view`; mappers to `DiscoveryProfileResult` / `DiscoveryOrgResult`. |
| `apps/web/src/lib/visibilityModel.ts` | **New.** In-code documentation of owner_private, public_profile, searchable_discovery; re-exports discovery allowlist/forbidden constants. |
| `apps/web/src/app/api/me/discovery/profiles/route.ts` | **New.** GET: auth required, entitlement check, returns discovery-safe profiles only. |
| `apps/web/src/app/api/me/discovery/orgs/route.ts` | **New.** GET: auth required, entitlement check, returns discovery-safe orgs only. |
| `docs/DISCOVERY_FOUNDATION_DELIVERABLES.md` | **New.** This document. |

---

## 2. Server-side contract created

- **Discovery types:** `DiscoveryProfileResult`, `DiscoveryOrgResult`, `DiscoverySearchResult` in `discoveryAllowlist.ts`. Explicit allowlist; no id, email, location, pricing, auth ids, or private metadata.
- **Server mapper:** `discoveryService.ts` selects only allowlisted columns from `public_profile_view` and `public_org_view`, maps rows to discovery DTOs. Never uses owner payloads or raw DB rows in responses.
- **Entitlement:** `entitlementDiscovery.ts` — single place for “can this user use discovery?”; currently env stub, ready for billing/feature-flag/allowlist.
- **Visibility model:** Documented in `visibilityModel.ts` and `discoveryAllowlist.ts`: owner_private, public_profile, searchable_discovery; searchable_discovery ≠ public_profile.

---

## 3. API routes and guard

| Route | Method | Auth | Entitlement | Response |
|-------|--------|------|-------------|----------|
| `/api/me/discovery/profiles` | GET | Required (Bearer) | Required | `{ ok: true, profiles: DiscoveryProfileResult[] }` |
| `/api/me/discovery/orgs` | GET | Required (Bearer) | Required | `{ ok: true, orgs: DiscoveryOrgResult[] }` |

**Query params (both):** `limit` (default 20, max 100), `offset` (default 0), `q` (optional search filter).

**Guards:**
- No token or invalid session → 401.
- Not eligible for discovery → 403 `DISCOVERY_NOT_ELIGIBLE`.
- Eligible → service role reads views with allowlisted columns only, returns discovery DTOs.

Discovery is only available to authenticated, eligible users; never a public or SEO surface.

---

## 4. Schema / migration added

**None.** No new tables, columns, or migrations. Reuses existing `public_profile_view` and `public_org_view` with explicit server-side column allowlists.

---

## 5. Final discovery allowlist (safe fields only)

**Profiles:**  
`type`, `username`, `display_name`, `avatar_url`, `bio`, `profile_type`, `twitter_username`, `xscore`, `analytics_snapshot` (followers, engagement_rate only), `tags`.

**Orgs:**  
`type`, `slug`, `name`, `tagline`, `logo_url`, `twitter_username`, `xscore`, `analytics_snapshot` (null for orgs in current view), `ecosystem_categories`.

Analytics in discovery is high-level snapshot only (e.g. followers, engagement_rate from view); /analytics remains the owner of deep analytics.

---

## 6. Final forbidden-fields list (never in discovery)

- email, contact_email  
- location, street, city, exact location  
- pricing, pricing_notes, meta  
- user_id, id (internal), auth, internal_id  
- private_metadata, private_reviews  
- unpublished, hidden  
- cdp_wallet_address  
- Anything not explicitly allowlisted  

---

## 7. Regression checklist

- [ ] **Authenticated eligible user** — With `LINKARY_DISCOVERY_ELIGIBLE=true`, GET `/api/me/discovery/profiles` and `/api/me/discovery/orgs` with valid Bearer token return 200 and discovery payloads; no email, location, pricing, or auth ids in response.
- [ ] **Authenticated non-eligible user** — Without env flag (or future: no plan), same requests return 403 DISCOVERY_NOT_ELIGIBLE; no discovery data in body.
- [ ] **Anonymous access blocked** — Request without Authorization or with invalid token returns 401; no discovery data.
- [ ] **No email in discovery payload** — Inspect response JSON; no `email` or `contact_email` field.
- [ ] **No exact location in discovery payload** — No `location`, `street`, `city` in profiles/orgs.
- [ ] **No pricing in discovery payload** — No `pricing`, `pricing_notes`, or pricing inside `meta`.
- [ ] **No auth/account ids in discovery payload** — No `user_id`, `id` (profile/org internal id), or auth identifiers.
- [ ] **No private metadata in discovery payload** — No raw `meta` or private metadata fields.
- [ ] **Discovery does not exceed allowed fields** — Response shape matches `DiscoveryProfileResult` / `DiscoveryOrgResult` only.
- [ ] **Public profile unchanged** — /{username} and /api/public/profile behave as before; location/pricing/analytics gating unchanged.
- [ ] **/analytics ownership unchanged** — Deep analytics and private insights remain owner-only; discovery uses only approved snapshot fields.
- [ ] **No mock data path reintroduced** — No user journey hits mock/demo discovery data.

---

## 8. Intentionally not built yet

- Full search/discovery UI or search page.
- Full monetization or checkout flow for discovery.
- Real entitlement implementation (billing tier, feature flag, or allowlist) — currently env stub only.
- Public or unauthenticated discovery endpoint.
- Any new schema or migration for discovery.
- Discovery-specific analytics beyond what the existing views already expose (followers_total, avg_engagement_rate, xscore).
- Coupling discovery to public DTOs as the only source — discovery has its own server-side mapper and contract.
