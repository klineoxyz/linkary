# Analytics UX consistency (owner vs cross-user)

Practical checklist for the analytics presentation pass. **No pipeline changes**—UI and copy only.

## Entry points (apps/web)

| Surface | Route / usage | Data source | Owner vs cross-user |
|--------|----------------|-------------|---------------------|
| **AnalyticsPage** | `/app/analytics` | Owner KPI API + `GET /api/analytics/init-status` | **Owner** — refresh, freshness, private sync hints |
| **Insights tab / profile dashboard** | Profile insights & `ProfileDashboardPage` embedded analytics | v2 owner analytics API (`/api/analytics/x`, etc.) | **Owner** — aligned banners/CTAs via shared lib (legacy `AnalyticsTabContent` removed) |
| **CrossUserAnalyticsPage** | `/app/analytics/profile/[username]` | `GET /api/me/analytics/profile/:username` (aggregates only) | **Cross-user** — no refresh, no last-sync, no job errors |
| **IntegrationsPage** | Settings → Integrations | N/A (journey) | Links to Analytics after X connected |
| **DashboardPage** | Copy links to full Analytics | Deal/profile stats, not X window KPIs | Points to Analytics for full X |

Shared presentation: `apps/web/src/lib/analytics-owner-state-presentation.ts`  
Cross-user empty copy only: `CROSS_USER_ANALYTICS_EMPTY_*` (do not use owner banners on cross-user).

## Owner states (`owner_analytics_state` from init-status)

| State | Typical DB/job condition | User should see |
|-------|---------------------------|-----------------|
| `no_x_handle` | No linked X | Muted banner + Connect X / Integrations CTA |
| `never_synced` | Initialized false, no partial snapshot | Sync from Integrations → Analytics → request refresh |
| `queued_or_building` | Job queued/running | “Update in progress…” — no duplicate scary errors |
| `refresh_failed` | Job failed | Warn banner + request refresh (owner only); optional error detail on owner surfaces only |
| `partial_data` | Partial snapshots | History building; refresh optional |
| `ready_stale` | Sync older than threshold | Stale hint + request refresh on Analytics |
| `ready_recent` | Healthy | Freshness subline; optional “no activity in window” when zeros are real |

## Cross-user behavior

- Empty aggregates → **“No public analytics snapshot”** + intentional body copy (not “broken”).
- No refresh controls, no `last_sync_at`, no operator diagnostics.

## QA — regression

1. **Owner — no X:** Integrations CTA from Analytics header + banner; tab shows same tone + Integrations link.
2. **Owner — never synced:** After connecting X, Sync from X → Analytics shows request refresh; Integrations blurb mentions Analytics + refresh.
3. **Owner — queued:** Refresh button disabled / “in progress”; banner matches Analytics vs tab.
4. **Owner — failed job:** Request refresh + consistent messaging; tab can show `last_error` (owner only).
5. **Cross-user — no snapshot:** Dashed card, privacy-safe title/body; no timestamps.
6. **Cross-user — with data:** Metrics only; still no refresh.

## Future polish (not required for this pass)

- Deeper visual hierarchy on AnalyticsPage KPI grid
- Toasts instead of inline refresh feedback
- Single loading skeleton shared tab vs page
