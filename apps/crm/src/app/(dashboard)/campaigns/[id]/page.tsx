import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import {
  getCampaign,
  getCampaignKpis,
  getCampaignContributors,
  getCampaignSubmissions,
  getCampaignTopContributors,
} from "@/lib/campaigns";
import { SubmissionReviewRow } from "./SubmissionReviewRow";
import { ArrowLeft } from "lucide-react";

function KpiCard({
  label,
  value,
  sub,
  insufficient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  insufficient?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
      <p className="text-xs font-medium text-[var(--crm-muted)] uppercase tracking-wide">
        {label}
        {insufficient && (
          <span className="ml-1 normal-case text-[var(--crm-muted)]">(no data yet)</span>
        )}
      </p>
      <p className="mt-1 text-xl font-semibold text-[var(--crm-primary)]">
        {value}
      </p>
      {sub != null && sub !== "" && (
        <p className="mt-0.5 text-xs text-[var(--crm-muted)]">{sub}</p>
      )}
    </div>
  );
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) notFound();

  const { id } = await params;
  const campaign = await getCampaign(supabase, id);
  if (!campaign) notFound();

  const [kpis, contributors, submissions, topContributors] = await Promise.all([
    getCampaignKpis(supabase, id, {
      budget: campaign.budget,
      currency: campaign.currency,
    }),
    getCampaignContributors(supabase, id),
    getCampaignSubmissions(supabase, id),
    getCampaignTopContributors(supabase, id),
  ]);

  const noMetrics = !kpis.has_metrics;

  return (
    <div className="space-y-8">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--crm-muted)] hover:text-[var(--crm-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">
          {campaign.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-[var(--crm-muted)]">
          <span className="rounded px-2 py-0.5 bg-[var(--crm-bg)]">
            {campaign.status}
          </span>
          {campaign.starts_at && (
            <span>
              {new Date(campaign.starts_at).toLocaleDateString()}
              {campaign.ends_at
                ? ` – ${new Date(campaign.ends_at).toLocaleDateString()}`
                : ""}
            </span>
          )}
        </div>
        {campaign.description && (
          <p className="mt-2 text-sm text-[var(--crm-muted)]">
            {campaign.description}
          </p>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
          KPIs
        </h2>
        {noMetrics && (
          <p className="text-sm text-[var(--crm-muted)] mb-4">
            Stored metrics not yet available. Values below are from participant
            and submission counts only; views/engagements/CPV/CPE need daily
            metrics snapshots.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total views / reach"
            value={kpis.total_views.toLocaleString()}
            insufficient={noMetrics}
          />
          <KpiCard
            label="Total engagements"
            value={kpis.total_engagements.toLocaleString()}
            insufficient={noMetrics}
          />
          <KpiCard
            label="Contributors"
            value={kpis.total_contributors}
          />
          <KpiCard
            label="Submissions"
            value={kpis.total_submissions}
          />
          <KpiCard
            label="Budget used"
            value={`${kpis.currency} ${kpis.budget_used.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            sub={
              kpis.budget_total != null
                ? `of ${kpis.currency} ${kpis.budget_total.toLocaleString()}`
                : undefined
            }
          />
          <KpiCard
            label="CPV (cost per view)"
            value={
              kpis.cpv != null
                ? `${kpis.currency} ${kpis.cpv.toFixed(4)}`
                : "—"
            }
            insufficient={noMetrics || kpis.cpv == null}
          />
          <KpiCard
            label="CPE (cost per engagement)"
            value={
              kpis.cpe != null
                ? `${kpis.currency} ${kpis.cpe.toFixed(4)}`
                : "—"
            }
            insufficient={noMetrics || kpis.cpe == null}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
          Top contributors
        </h2>
        {topContributors.length === 0 ? (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
            No submissions yet; top contributors will appear here.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Contributor
                  </th>
                  <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">
                    Submissions
                  </th>
                </tr>
              </thead>
              <tbody>
                {topContributors.map((t) => (
                  <tr
                    key={t.participant_profile_id}
                    className="border-b border-[var(--crm-border)] last:border-0"
                  >
                    <td className="p-3 font-mono text-xs text-[var(--crm-muted)]">
                      {t.participant_profile_id.slice(0, 8)}…
                    </td>
                    <td className="p-3 text-right">
                      {t.submission_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
          Contributors
        </h2>
        {contributors.length === 0 ? (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
            No participants yet.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Participant
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Role
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Status
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Accepted
                  </th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--crm-border)] last:border-0"
                  >
                    <td className="p-3 font-mono text-xs text-[var(--crm-muted)]">
                      {p.participant_profile_id.slice(0, 8)}…
                    </td>
                    <td className="p-3">{p.role}</td>
                    <td className="p-3">
                      <span className="rounded px-2 py-0.5 text-xs bg-[var(--crm-bg)]">
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-[var(--crm-muted)]">
                      {p.accepted_at
                        ? new Date(p.accepted_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
          Submissions
        </h2>
        {submissions.length === 0 ? (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
            No submissions yet.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Platform
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    URL
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Status
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Date
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Review
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <SubmissionReviewRow
                    key={s.id}
                    submission={{
                      id: s.id,
                      platform: s.platform,
                      url: s.url,
                      status: s.status,
                      created_at: s.created_at,
                      rejection_reason: s.rejection_reason,
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </section>
    </div>
  );
}
