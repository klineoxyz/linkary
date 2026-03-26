import Link from "next/link";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsLaunchDiagnostics } from "@/lib/opsLaunchDiagnostics";

function fmtIso(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toISOString().replace("T", " ").slice(0, 19) + " UTC" : String(iso);
}

export default async function OpsLaunchDiagnosticsPage() {
  const { service } = await assertOpsPageAccess();
  const d = await fetchOpsLaunchDiagnostics(service);

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Launch diagnostics</h1>
        <p className="crm-page-subtitle">
          Read-only ingestion freshness, analytics queue state, and environment presence flags for operators. Generated{" "}
          <span className="font-mono text-xs">{fmtIso(d.generatedAt)}</span>. JSON:{" "}
          <Link href="/api/ops/diagnostics/launch" className="text-[var(--crm-primary)] underline-offset-2 hover:underline">
            /api/ops/diagnostics/launch
          </Link>
        </p>
      </header>

      {d.warnings.length > 0 ? (
        <div
          className="rounded-[var(--crm-radius)] border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          <p className="font-semibold mb-2">Attention</p>
          <ul className="list-disc pl-5 space-y-1">
            {d.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="crm-surface-raised rounded-[var(--crm-radius)] border border-[var(--crm-border)] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Environment (presence only)</h2>
        <p className="text-xs text-[var(--crm-muted)]">
          Values are yes/no — secrets are never shown. Fix missing keys in the CRM deployment environment.
        </p>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {Object.entries(d.env_flags).map(([k, v]) => (
              <tr key={k} className="border-b border-[var(--crm-border)] last:border-0">
                <td className="py-2 pr-4 font-mono text-xs text-[var(--crm-muted)]">{k}</td>
                <td className="py-2">{v ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="crm-surface-raised rounded-[var(--crm-radius)] border border-[var(--crm-border)] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">CRM Layer 1 — `crm_campaign_metrics_daily`</h2>
        <p className="text-xs text-[var(--crm-muted)]">
          Stale if no new row written in {d.thresholds.crm_metrics_stale_after_hours}h (cron is typically daily).
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Latest row `created_at`</dt>
            <dd className="font-mono tabular-nums">{fmtIso(d.crmCampaignMetricsDaily.last_row_created_at)}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Rows written (last 24h)</dt>
            <dd>{d.crmCampaignMetricsDaily.rows_written_last_24h ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Stale flag</dt>
            <dd>{d.crmCampaignMetricsDaily.is_stale ? "yes" : "no"}</dd>
          </div>
        </dl>
      </section>

      <section className="crm-surface-raised rounded-[var(--crm-radius)] border border-[var(--crm-border)] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Campaigns vs Layer 1 rows</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Campaigns (draft/active/paused/completed)</dt>
            <dd>{d.campaign_layer1.campaigns_in_scope ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Distinct campaigns with daily rows</dt>
            <dd>{d.campaign_layer1.distinct_campaigns_with_daily_rows ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Campaigns missing any daily row (scan cap 4k)</dt>
            <dd>{d.campaign_layer1.campaigns_missing_layer1_count ?? "—"}</dd>
          </div>
        </dl>
        {d.campaign_layer1.campaigns_missing_layer1_sample.length > 0 ? (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border border-[var(--crm-border)] rounded-md">
              <thead>
                <tr className="bg-[var(--crm-accent)] text-left">
                  <th className="p-2 font-medium">Campaign</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {d.campaign_layer1.campaigns_missing_layer1_sample.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--crm-border)]">
                    <td className="p-2 max-w-[220px] truncate" title={c.title ?? ""}>
                      {c.title ?? "—"}
                    </td>
                    <td className="p-2">{c.status ?? "—"}</td>
                    <td className="p-2 font-mono">{c.id.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="crm-surface-raised rounded-[var(--crm-radius)] border border-[var(--crm-border)] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">X pipeline (profiles / tweets / snapshots)</h2>
        <p className="text-xs text-[var(--crm-muted)]">
          Worker/Railway drives most ingestion; these DB signals indicate freshness. Flag if latest profile sync &gt;{" "}
          {d.thresholds.profile_sync_stale_after_hours}h old.
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Latest `profiles.x_last_tweets_sync_at` (any profile)</dt>
            <dd className="font-mono text-xs break-all">{fmtIso(d.x_pipeline.latest_x_last_tweets_sync_at)}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Profiles with any sync timestamp</dt>
            <dd>{d.x_pipeline.profiles_with_x_sync_count ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">`x_tweets` rows with `created_at` in last 24h</dt>
            <dd>{d.x_pipeline.x_tweets_rows_created_last_24h ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Latest `x_tweets.created_at`</dt>
            <dd className="font-mono text-xs">{fmtIso(d.x_pipeline.latest_x_tweet_row_created_at)}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Latest `x_daily_snapshots.day`</dt>
            <dd>{d.x_pipeline.x_daily_snapshots_latest_day ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Latest snapshot row `created_at`</dt>
            <dd className="font-mono text-xs">{fmtIso(d.x_pipeline.x_daily_snapshots_latest_created_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="crm-surface-raised rounded-[var(--crm-radius)] border border-[var(--crm-border)] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">`analytics_jobs` queue</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Queued</dt>
            <dd>{d.analytics_jobs.queued ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Running</dt>
            <dd>{d.analytics_jobs.running ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--crm-muted)] text-xs">Last done `x_backfill_90d`</dt>
            <dd className="font-mono text-xs">{fmtIso(d.analytics_jobs.last_done_backfill_at)}</dd>
          </div>
        </dl>
        {d.analytics_jobs.failed_last_10.length > 0 ? (
          <div className="overflow-x-auto mt-3">
            <p className="text-xs text-[var(--crm-muted)] mb-2">Recent failed jobs (max 10)</p>
            <table className="w-full text-xs border border-[var(--crm-border)] rounded-md">
              <thead>
                <tr className="bg-[var(--crm-accent)] text-left">
                  <th className="p-2 font-medium">Updated</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium">Attempts</th>
                  <th className="p-2 font-medium">Last error</th>
                </tr>
              </thead>
              <tbody>
                {d.analytics_jobs.failed_last_10.map((j) => (
                  <tr key={j.id} className="border-t border-[var(--crm-border)] align-top">
                    <td className="p-2 font-mono whitespace-nowrap">{fmtIso(j.updated_at)}</td>
                    <td className="p-2">{j.job_type}</td>
                    <td className="p-2">{j.attempts}</td>
                    <td className="p-2 break-all max-w-md">{j.last_error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-[var(--crm-muted)]">No failed job rows returned (limited query).</p>
        )}
      </section>

      <section className="crm-surface-raised rounded-[var(--crm-radius)] border border-[var(--crm-border)] p-5 text-sm text-[var(--crm-muted)] space-y-2">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Related docs</h2>
        <p>
          Internal runbook: <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">docs/LAUNCH_OPS_RUNBOOK.md</code>{" "}
          (repo root).
        </p>
        <p>
          Web health (Linkary app, CRON_SECRET): <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">GET /api/cron/health/x-analytics</code> on the main web deployment — not the CRM app.
        </p>
      </section>
    </div>
  );
}
