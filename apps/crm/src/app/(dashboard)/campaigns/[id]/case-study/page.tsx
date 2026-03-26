import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { getCampaignReportData } from "@/lib/report";
import { ParticipantCell } from "@/components/ParticipantCell";
import { toParticipantLabel } from "@/lib/profileDisplay";
import { parseSubmissionMetricsExtended } from "@/lib/reportAggregates";
import { CampaignAttributionNote } from "@/components/CampaignAttributionNote";
import { PrintCaseStudyButton } from "./PrintCaseStudyButton";

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  twitter_username: string | null;
  avatar_url: string | null;
};

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n}%`;
}

function fmtMoney(n: number | null | undefined, cur: string) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function KpiCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--crm-border)] bg-gradient-to-b from-[var(--crm-card)] to-[var(--crm-bg)] p-5 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--crm-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--crm-foreground)]">{value}</p>
      {note ? <p className="mt-1 text-xs text-[var(--crm-muted)]">{note}</p> : null}
    </div>
  );
}

function TinyBarChart({
  title,
  series,
  color,
  valueKey,
}: {
  title: string;
  series: { day: string; views: number; engagements: number; posts: number }[];
  color: string;
  valueKey: "views" | "engagements" | "posts";
}) {
  const max = Math.max(1, ...series.map((s) => s[valueKey]));
  return (
    <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-5 shadow-sm">
      <p className="text-sm font-semibold text-[var(--crm-foreground)]">{title}</p>
      <div className="mt-4 flex h-36 items-end gap-1.5 rounded-xl bg-[var(--crm-bg)] p-3">
        {series.slice(-31).map((s) => {
          const h = Math.max(2, Math.round((s[valueKey] / max) * 100));
          return (
            <div
              key={`${valueKey}-${s.day}`}
              className="w-2.5 rounded-md"
              style={{ height: `${h}%`, backgroundColor: color }}
              title={`${s.day}: ${s[valueKey]}`}
            />
          );
        })}
      </div>
      <p className="mt-3 text-xs text-[var(--crm-muted)]">Daily values in campaign window (last 31 points shown)</p>
    </div>
  );
}

export default async function CaseStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) notFound();

  const { id } = await params;
  const data = await getCampaignReportData(supabase, id);
  if (!data) notFound();

  const {
    campaign,
    start_date,
    end_date,
    total_posts,
    total_views,
    total_engagements,
    likes,
    replies,
    reposts,
    quotes,
    participant_enrolled_count,
    submissions,
    chart_series,
    efficiency,
    participant_submission_rollups,
    top_contributors_approved_submissions,
    top_by_proof_contribution_percent,
    top_by_contribution_percent,
    top_by_submission_snapshot_views,
    top_by_submission_snapshot_engagements,
    promoted_social_handles,
    promoted_org_id,
  } = data;

  const ids = Array.from(
    new Set([
      ...participant_submission_rollups.map((r) => r.participant_profile_id),
      ...submissions.map((s) => s.participant_profile_id),
      ...top_contributors_approved_submissions.map((t) => t.participant_profile_id),
      ...top_by_proof_contribution_percent.map((t) => t.participant_profile_id),
      ...top_by_contribution_percent.map((t) => t.participant_profile_id),
      ...top_by_submission_snapshot_views.map((t) => t.participant_profile_id),
      ...top_by_submission_snapshot_engagements.map((t) => t.participant_profile_id),
    ])
  );
  const { data: profiles } =
    ids.length > 0
      ? await supabase.from("profiles").select("id, username, display_name, twitter_username, avatar_url").in("id", ids)
      : { data: [] as ProfileRow[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow]));

  const approvedSubmissions = submissions.filter((s) => (s.status ?? "").toLowerCase() === "approved").length;
  const engagementParts = [
    { key: "likes", label: "Likes", value: likes ?? 0, color: "#60a5fa" },
    { key: "replies", label: "Replies", value: replies ?? 0, color: "#34d399" },
    { key: "reposts", label: "Reposts", value: reposts ?? 0, color: "#f59e0b" },
    { key: "quotes", label: "Quotes", value: quotes ?? 0, color: "#a78bfa" },
  ].filter((x) => x.value > 0);
  const engagementTotal = engagementParts.reduce((s, x) => s + x.value, 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-10 pb-16">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { break-before: page; page-break-before: always; }
          .print-tight { margin-top: 0 !important; padding-top: 0 !important; }
          table { font-size: 11px !important; }
          section { box-shadow: none !important; }
          a { text-decoration: none !important; color: inherit !important; }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center gap-3">
        <Link
          href={`/campaigns/${id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2 text-sm hover:bg-[var(--crm-bg)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to campaign
        </Link>
        <Link
          href={`/campaigns/${id}/report`}
          className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2 text-sm hover:bg-[var(--crm-bg)]"
        >
          Open operator report
        </Link>
        <PrintCaseStudyButton />
      </div>

      <section className="rounded-3xl border border-[var(--crm-border)] bg-gradient-to-br from-[var(--crm-card)] via-[var(--crm-card)] to-[var(--crm-bg)] p-8 shadow-sm print-tight">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--crm-muted)]">Campaign Case Study</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[var(--crm-foreground)]">{campaign.title}</h1>
        <div className="mt-6 grid gap-3 text-sm text-[var(--crm-muted)] sm:grid-cols-2 lg:grid-cols-4">
          <p><strong className="text-[var(--crm-foreground)]">Period:</strong> {start_date ? new Date(start_date).toLocaleDateString() : "—"} - {end_date ? new Date(end_date).toLocaleDateString() : "—"}</p>
          <p><strong className="text-[var(--crm-foreground)]">Status:</strong> {campaign.status}</p>
          <p><strong className="text-[var(--crm-foreground)]">Campaign value:</strong> {fmtMoney(campaign.campaign_value_usd, campaign.currency ?? "USD")}</p>
          <p><strong className="text-[var(--crm-foreground)]">Promoted account(s):</strong> {promoted_social_handles.length > 0 ? promoted_social_handles.map((h) => `${h.platform}:${h.handle}`).join(", ") : promoted_org_id ? `org ${promoted_org_id}` : "—"}</p>
        </div>
        {campaign.campaign_objective ? (
          <p className="mt-5 max-w-[980px] text-sm leading-6 text-[var(--crm-foreground)]">{campaign.campaign_objective}</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--crm-foreground)]">Campaign totals</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Participants enrolled" value={fmtNum(participant_enrolled_count)} />
          <KpiCard label="Proof submissions" value={fmtNum(submissions.length)} />
          <KpiCard label="Approved submissions" value={fmtNum(approvedSubmissions)} />
          <KpiCard label="Promoted-account posts" value={fmtNum(total_posts)} />
          <KpiCard label="Total views / impressions" value={fmtNum(total_views)} />
          <KpiCard label="Total engagements" value={fmtNum(total_engagements)} />
          <KpiCard label="Likes / Replies" value={`${fmtNum(likes)} / ${fmtNum(replies)}`} />
          <KpiCard label="Reposts / Quotes" value={`${fmtNum(reposts)} / ${fmtNum(quotes)}`} />
          <KpiCard label="CPV" value={efficiency.cpv != null ? fmtMoney(efficiency.cpv, efficiency.currency) : "—"} note={efficiency.cpv == null ? "Hidden when spend/denominator unavailable" : undefined} />
          <KpiCard label="CPM" value={efficiency.cpm != null ? fmtMoney(efficiency.cpm, efficiency.currency) : "—"} note={efficiency.cpm == null ? "Hidden when spend/denominator unavailable" : undefined} />
          <KpiCard label="CPE" value={efficiency.cpe != null ? fmtMoney(efficiency.cpe, efficiency.currency) : "—"} note={efficiency.cpe == null ? "Hidden when spend/denominator unavailable" : undefined} />
          <KpiCard label="CPC" value="Unsupported" note="No click-ingest truth in current CRM model" />
        </div>
      </section>

      <section className="print-break">
        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--crm-foreground)]">Performance charts</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <TinyBarChart title="Daily views / impressions" series={chart_series} color="#60a5fa" valueKey="views" />
          <TinyBarChart title="Daily engagements" series={chart_series} color="#34d399" valueKey="engagements" />
          <TinyBarChart title="Daily posts" series={chart_series} color="#f59e0b" valueKey="posts" />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--crm-foreground)]">Engagement breakdown</h2>
        {engagementParts.length === 0 ? (
          <p className="text-sm text-[var(--crm-muted)]">No supported engagement-part totals available.</p>
        ) : (
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-5 shadow-sm">
            <div className="space-y-3">
              {engagementParts.map((p) => (
                <div key={p.key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-[var(--crm-foreground)]">{p.label}</span>
                    <span className="text-[var(--crm-muted)]">{fmtNum(p.value)} ({((p.value / engagementTotal) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="h-3.5 rounded-full bg-[var(--crm-bg)]">
                    <div className="h-3.5 rounded-full" style={{ width: `${(p.value / engagementTotal) * 100}%`, backgroundColor: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="print-break">
        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--crm-foreground)]">Individual participant contribution</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] shadow-sm">
          <table className="w-full min-w-[1200px] text-sm">
            <thead>
              <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)] text-xs uppercase tracking-wide text-[var(--crm-muted)]">
                <th className="p-3 text-left">Participant</th>
                <th className="p-3 text-right">Submissions</th>
                <th className="p-3 text-right">Approved</th>
                <th className="p-3 text-right">Proof share</th>
                <th className="p-3 text-right">Task contribution</th>
                <th className="p-3 text-right">Σ views</th>
                <th className="p-3 text-right">Σ engagements</th>
                <th className="p-3 text-right">Σ likes</th>
                <th className="p-3 text-right">Σ replies</th>
                <th className="p-3 text-right">Σ reposts</th>
                <th className="p-3 text-right">Σ quotes</th>
                <th className="p-3 text-left">Latest proof</th>
              </tr>
            </thead>
            <tbody>
              {participant_submission_rollups.map((r, idx) => (
                <tr key={r.participant_profile_id} className="border-b border-[var(--crm-border)] last:border-0 hover:bg-[var(--crm-bg)]/70">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--crm-bg)] text-xs font-semibold">{idx + 1}</span>
                      <ParticipantCell
                        avatarUrl={profileById.get(r.participant_profile_id)?.avatar_url}
                        label={toParticipantLabel(profileById.get(r.participant_profile_id), r.participant_profile_id)}
                      />
                    </div>
                  </td>
                  <td className="p-3 text-right">{r.submissions_total}</td>
                  <td className="p-3 text-right">{r.approved}</td>
                  <td className="p-3 text-right">{fmtPct(r.proof_contribution_percent)}</td>
                  <td className="p-3 text-right">{fmtPct(r.task_contribution_percent)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_impressions_or_views_sum)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_engagements_sum)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_likes_sum)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_replies_sum)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_reposts_sum)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_quotes_sum)}</td>
                  <td className="p-3">
                    {r.latest_approved_proof_url ? (
                      <a href={r.latest_approved_proof_url} target="_blank" rel="noopener noreferrer" className="text-[var(--crm-primary)] underline">
                        Latest approved
                      </a>
                    ) : r.latest_proof_url ? (
                      <a href={r.latest_proof_url} target="_blank" rel="noopener noreferrer" className="text-[var(--crm-primary)] underline">
                        Latest proof
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--crm-foreground)]">Top performers</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-5 shadow-sm">
            <h3 className="font-semibold">Top by approved submissions</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {top_contributors_approved_submissions.slice(0, 5).map((t, i) => (
                <li key={`a-${t.participant_profile_id}`} className="flex justify-between">
                  <span>{i + 1}. {toParticipantLabel(profileById.get(t.participant_profile_id), t.participant_profile_id)}</span>
                  <strong>{t.submission_count}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-5 shadow-sm">
            <h3 className="font-semibold">Top by proof share %</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {top_by_proof_contribution_percent.slice(0, 5).map((t, i) => (
                <li key={`p-${t.participant_profile_id}`} className="flex justify-between">
                  <span>{i + 1}. {toParticipantLabel(profileById.get(t.participant_profile_id), t.participant_profile_id)}</span>
                  <strong>{fmtPct(t.proof_contribution_percent)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-5 shadow-sm">
            <h3 className="font-semibold">Top by task contribution %</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {top_by_contribution_percent.slice(0, 5).map((t, i) => (
                <li key={`t-${t.participant_profile_id}`} className="flex justify-between">
                  <span>{i + 1}. {toParticipantLabel(profileById.get(t.participant_profile_id), t.participant_profile_id)}</span>
                  <strong>{fmtPct(t.contribution_percent)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-5 shadow-sm">
            <h3 className="font-semibold">Top by submitted-post views / engagements</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {top_by_submission_snapshot_views.slice(0, 5).map((t, i) => {
                const eng = top_by_submission_snapshot_engagements.find((e) => e.participant_profile_id === t.participant_profile_id);
                return (
                  <li key={`v-${t.participant_profile_id}`} className="flex justify-between">
                    <span>{i + 1}. {toParticipantLabel(profileById.get(t.participant_profile_id), t.participant_profile_id)}</span>
                    <strong>{fmtNum(t.approved_with_snapshot_sum)} / {fmtNum(eng?.approved_with_snapshot_engagements_sum ?? 0)}</strong>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section className="print-break">
        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-[var(--crm-foreground)]">Proof / content</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] shadow-sm">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)] text-xs uppercase tracking-wide text-[var(--crm-muted)]">
                <th className="p-3 text-left">Participant</th>
                <th className="p-3 text-left">Proof URL</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Views</th>
                <th className="p-3 text-right">Engagements</th>
                <th className="p-3 text-right">Likes</th>
                <th className="p-3 text-right">Replies</th>
                <th className="p-3 text-right">Reposts</th>
                <th className="p-3 text-right">Quotes</th>
                <th className="p-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const m = parseSubmissionMetricsExtended(s.metrics_snapshot);
                return (
                  <tr key={s.id} className="border-b border-[var(--crm-border)] last:border-0 hover:bg-[var(--crm-bg)]/70">
                    <td className="p-3">{toParticipantLabel(profileById.get(s.participant_profile_id), s.participant_profile_id)}</td>
                    <td className="p-3">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[var(--crm-primary)] underline break-all">
                        {s.url}
                      </a>
                    </td>
                    <td className="p-3 capitalize">{s.status}</td>
                    <td className="p-3 text-right">{fmtNum(m.impressions ?? m.views)}</td>
                    <td className="p-3 text-right">{fmtNum(m.engagements)}</td>
                    <td className="p-3 text-right">{fmtNum(m.likes)}</td>
                    <td className="p-3 text-right">{fmtNum(m.replies)}</td>
                    <td className="p-3 text-right">{fmtNum(m.reposts)}</td>
                    <td className="p-3 text-right">{fmtNum(m.quotes)}</td>
                    <td className="p-3">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-5 text-xs text-[var(--crm-muted)] shadow-sm">
        <h2 className="mb-2 text-base font-semibold tracking-tight text-[var(--crm-foreground)]">Attribution & limitations</h2>
        <ul className="space-y-1">
          <li>Promoted-account totals (Layer 1) are separate from participant CRM contribution (Layer 2).</li>
          <li>Participant contribution uses CRM proof/tasks data (`crm_submissions`, `crm_tasks`, `crm_campaign_participants`).</li>
          <li>Per-post proof metrics use `crm_submissions.metrics_snapshot` and are shown only when available; unsupported fields remain hidden.</li>
          <li>CPM/CPV/CPE are shown only when spend and denominators are real; CPC is intentionally unsupported.</li>
        </ul>
      </section>

      <CampaignAttributionNote />
    </div>
  );
}
