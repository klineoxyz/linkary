# Launch pre-onboarding hardening — audit summary

## 1) Already correct (before this pass)

- **Cross-user analytics API** (`GET /api/me/analytics/profile/[username]`) — auth, discovery eligibility, rate limit with `resetAt`, allowlisted aggregates only; self → 400 `USE_OWN_ANALYTICS`.
- **`fail()`** (`api-response.ts`) — `{ ok, code, message }`; 429 + `resetAt` + `Retry-After`.
- **Stored analytics** — owner `/api/analytics/x` contract; no live provider on passive page load (unchanged).
- **Org authority** — not altered (still `org_members`-based where implemented).
- **Web Vitals reporter** — present for basic RUM hook.

## 2) Was missing / weak

- **`GET /api/social/insights`** — returned **full** X insights (top followers, feed, series) for **any** username without owner check; **`GET /api/social/x/insights`** callable directly with same leak.
- **429 UX** — Cross-user analytics never entered `rate_limited` state (429 fell through to generic error). Analytics rebuild 429 did not surface `resetAt` in copy.
- **SWR dedupe** — `me-stats` / analytics keys duplicated as string literals across App, Dashboard, Insights.
- **Dashboard** — heavy `text-gray-*` instead of semantic tokens on main shell.
- **Release gate** — no single checklist doc for onboarding.

## 3) What changed

| Change | Detail |
|--------|--------|
| **Privacy** | `/api/social/insights` (X): **full** payload only if `viewerId === profileId` (session/Bearer). Else **snapshot_only** (public follower count + empty deep buckets). TikTok/YouTube caches only for owner. |
| **Lock `/api/social/x/insights`** | **403** unless profile owner **or** `CRON_SECRET` (same header pattern as other crons). |
| **Shared builder** | `buildSocialXInsightsPayload` — owner path calls lib directly (no open internal fetch). |
| **UI** | `InsightsSnapshot`: auth-aware fetcher for insights; **other users** — banner + score card only (no top followers/graphs). |
| **429** | `CrossUserAnalyticsPage` handles 429 + `resetAt`; `AnalyticsPage` rebuild + optional `RATE_LIMITED` GET message via `formatTryAgainAfter`. |
| **SWR keys** | `SWR_KEY_ME_STATS`, `SWR_KEY_OWNER_ANALYTICS_INIT`, `swrKeyAnalyticsX()` in `swrCacheKeys.ts`. |
| **Dashboard** | Gray text classes → `text-foreground` / `text-muted-foreground`. |
| **Monitoring** | Production one-line JSON log on social insights; `window.__linkary_reportError` optional hook after client errors. |

## 4) Files touched

- `apps/web/src/lib/buildSocialXInsightsPayload.ts` (new)
- `apps/web/src/lib/resolveViewerUserId.ts` (new)
- `apps/web/src/lib/rateLimitUx.ts` (new)
- `apps/web/src/lib/swrCacheKeys.ts` (new)
- `apps/web/src/lib/socialInsightsUnifiedContracts.ts`
- `apps/web/src/app/api/social/x/insights/route.ts`
- `apps/web/src/app/api/social/insights/route.ts`
- `apps/web/src/app/GlobalErrorCapture.tsx`
- `apps/web/src/figma/app/components/profile/InsightsSnapshot.tsx`
- `apps/web/src/figma/app/components/CrossUserAnalyticsPage.tsx`
- `apps/web/src/figma/app/components/AnalyticsPage.tsx`
- `apps/web/src/figma/app/components/DashboardPage.tsx`
- `apps/web/src/figma/app/App.tsx`
- `docs/ONBOARDING_RELEASE_GATE.md` (new)
- `docs/LAUNCH_PREBOARDING_HARDENING.md` (this file)

## 5) Migrations

**None.**

## 6) API contract changes

| Endpoint | Change |
|----------|--------|
| `GET /api/social/insights?provider=x&username=` | Always **200** for valid username. **Owner** (Bearer/session matches profile): full unified body, `meta.visibility: "full"`. **Else**: `meta.visibility: "snapshot_only"`, `meta.reason: "INSIGHTS_NOT_OWNER"` (or `PROFILE_NOT_FOUND`). Empty top followers / feed / mentions / series. |
| `GET /api/social/x/insights?username=` | **403** `{ ok:false, code:"INSIGHTS_OWNER_ONLY", ... }` unless owner or cron. |
| TikTok/YouTube via unified | Non-owner: public stub only, no service cache payload. |

## 7) Intentionally deferred

- **Sentry npm package** — hook `window.__linkary_reportError` documented; install `@sentry/browser` when ready.
- **IP rate limit** on snapshot insights — low risk (no deep data); add if abused.
- **Full dashboard redesign** — token swap only.

## 8) Final verdict

| Question | Answer |
|----------|--------|
| **Launch-ready (privacy / rate UX / dedupe / light theme / gate doc)** | **Yes** for controlled onboarding, after manual QA on the release gate. |
| **Blocks onboarding** | None identified in code review; **blockers** = failed QA items (auth, invite gate, broken CRM/sourcing). |
| **Safe to start onboarding** | **Yes (limited)** — complete `ONBOARDING_RELEASE_GATE.md` checklist first. |
