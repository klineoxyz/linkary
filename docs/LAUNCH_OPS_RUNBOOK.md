# Launch ops runbook (Linkary + CRM)

Concise operator reference for **analytics freshness**, **CRM campaign metrics**, **auth/env**, and **reports**. Not a product spec.

---

## 1. Verify analytics / X pipeline freshness

**Database signals (CRM — internal ops)**

1. Sign in to CRM with an **internal ops** account.
2. Open **Ops → Overview → Launch diagnostics** (`/ops/overview/launch-diagnostics`).
3. Review:
   - **Latest `profiles.x_last_tweets_sync_at`** — should be recent (worker runs on a schedule; see `docs/ANALYTICS_SCHEDULER_AUDIT.md`).
   - **`x_tweets` rows in last 24h** — non-zero when ingestion is active.
   - **`x_daily_snapshots`** latest day / `created_at` — advances as backfill runs.
   - **`analytics_jobs`** — queued count not exploding; failed rows show `last_error`.

**JSON (scripts / curl)**

- Same data as the page: `GET /api/ops/diagnostics/launch` with an **authenticated ops session** (browser cookie) or extend with a service token if you add one later.

**Linkary web app (not CRM)**

- `GET /api/cron/health/x-analytics` on the **main web** deployment with header `x-cron-secret: $CRON_SECRET` returns pipeline-oriented timestamps (`last_ingestion_run_at`, rollups, etc.). See `apps/web/src/app/api/cron/health/x-analytics/route.ts`.

---

## 2. Rerun CRM campaign metrics (`crm_campaign_metrics_daily`)

Layer 1 report data is aggregated into `crm_campaign_metrics_daily` by the web app ingest (see `apps/web/src/lib/crmCampaignMetricsDailyIngest.ts`).

**Manual trigger (production)**

- `POST` **https://&lt;web-app-host&gt;/api/cron/crm-campaign-metrics-daily`
- Header: `x-cron-secret: <CRON_SECRET>` (same secret as other crons).

**Requirements**

- **Supabase service role** on the server.
- **MODE A** (handles linked to Linkary profiles): `x_tweets` rows for tracked handles.
- **MODE B** (external handles): a **twitterapi.io**-compatible key (`TWITTERAPI_*` env on the **web** app where the cron runs).

---

## 3. Diagnose missing Layer 1 (campaign report / analytics)

| Symptom | Likely cause | What to check |
|--------|----------------|---------------|
| Empty daily metrics / “No daily rows yet” | No rows in `crm_campaign_metrics_daily` | Launch diagnostics → CRM section; rerun cron (§2). |
| Partial or zero impressions | Tweet rows missing `impression_count` / API `viewCount` | Ingest metadata note in `crm_campaign_metrics_daily.metadata`; external API window caps. |
| External handle, no data | **No API key** or handle not resolved | Env `TWITTERAPI_*` on web; `metadata.handles_external_omitted_no_api_key` in daily rows. |
| Campaign listed but no Layer 1 | Campaign never ingested or no tweets in window | **Launch diagnostics** sample table of campaigns without any daily row. |

---

## 4. Diagnose missing participant contribution (Layer 2)

Participant metrics come from **CRM submissions**, **tasks**, and **`metrics_snapshot`** on proofs — not from `crm_campaign_metrics_daily`.

1. Confirm **participants** enrolled and **submissions** exist (`crm_submissions`, `crm_campaign_participants`).
2. For proof-level numbers, approved rows with **`metrics_snapshot`** populate snapshot-based rollups.
3. **Ops → Reports → Campaign reports** or per-campaign CRM UI shows funnel; if “empty,” check RLS and workspace linkage, not only ingestion.

---

## 5. Ops permissions

- **Internal ops:** `internal_ops_members` (not revoked) — required for `/ops/*` and `/api/ops/*`.
- If a user should see Ops but gets **404**: membership row missing or revoked.
- **Audit:** Ops → Audit log (`/ops/audit/platform`) for entitlement-related changes.

---

## 6. Session / auth / env issues (CRM)

**Symptoms:** Login loops, redirect to wrong host, **503** on API routes.

| Check | Where |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | CRM env |
| `SUPABASE_SERVICE_ROLE_KEY` | CRM server (ops reads); missing → 404/503 on ops |
| `NEXT_PUBLIC_APP_URL` | Should match deployed CRM origin (OAuth redirect base) |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | Optional; wrong domain → session not shared across subdomains |
| `CRM_SYNC_SECRET` | Linkary sync API — must match Linkary side if used |

**Launch diagnostics** shows **presence-only** flags for these (never prints secret values).

---

## 7. PDF / report looks wrong

1. **Case-study / print** uses **browser print** — use browser “Print to PDF”; margins and fonts are controlled by the case-study page CSS.
2. **Wrong numbers:** distinguish **Layer 1** (promoted account daily metrics) vs **Layer 2** (participant proofs) — see campaign report copy.
3. **Stale charts:** verify **§1** and **§2**; reports are **stored data only** (no live third-party pull on every page load).

---

## 8. Launch-day checklist (minimal)

- [ ] CRM **Launch diagnostics** — no critical warnings; env flags all “yes” where required.
- [ ] Web **health/x-analytics** (CRON_SECRET) — timestamps plausible.
- [ ] **CRM campaign metrics** cron scheduled or manual run succeeds after deploy.
- [ ] **OAuth** test: sign in to CRM staging/production once.
- [ ] **Ops** user can open `/ops/overview/summary` and `/ops/overview/launch-diagnostics`.

---

## 9. Further reading

- `docs/ANALYTICS_SCHEDULER_AUDIT.md` — Railway vs Vercel, worker scripts.
- `docs/RAILWAY_WORKER_CRON.md` — worker commands.
- `docs/X_ANALYTICS_CRON.md` — web cron endpoints (manual).
