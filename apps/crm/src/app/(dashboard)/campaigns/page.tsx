import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { resolveCrmAccess } from "@/lib/access";
import { fetchCampaignsForUser } from "@/lib/campaigns";

export default async function CampaignsPage() {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) redirect("/login");

  const access = await resolveCrmAccess(supabase, user.id);
  if (access.orgWorkspaces.length === 0) {
    redirect("/");
  }

  const campaigns = await fetchCampaignsForUser(supabase);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">Campaigns</h1>
      <p className="text-sm text-[var(--crm-muted)]">
        Org campaign dashboard. View performance, contributors, and submissions.
      </p>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-8 text-center text-[var(--crm-muted)]">
          No campaigns yet. Create a campaign from your org workspace to get started.
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Campaign</th>
                <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Status</th>
                <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Date range</th>
                <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Budget</th>
                <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Participants</th>
                <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Submissions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-[var(--crm-border)] last:border-0">
                  <td className="p-3">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-medium text-[var(--crm-primary)] hover:underline"
                    >
                      {c.title}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className="rounded px-2 py-0.5 text-xs bg-[var(--crm-bg)] text-[var(--crm-muted)]">
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 text-[var(--crm-muted)]">
                    {c.starts_at || c.ends_at
                      ? [
                          c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "—",
                          c.ends_at ? new Date(c.ends_at).toLocaleDateString() : "—",
                        ].join(" → ")
                      : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {c.budget != null
                      ? `${c.currency ?? "USD"} ${Number(c.budget).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="p-3 text-right">{c.participant_count}</td>
                  <td className="p-3 text-right">{c.submission_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
