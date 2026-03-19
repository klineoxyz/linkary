import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { resolveCrmAccess } from "@/lib/access";
import { ensureOrgWorkspacesForUser } from "@/lib/orgWorkspaceBootstrap";
import { fetchCampaignsForUser } from "@/lib/campaigns";
import { ListTodo } from "lucide-react";

export default async function CampaignsPage() {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) redirect("/login");

  let access = await resolveCrmAccess(supabase, user.id);

  if (access.orgWorkspaces.length === 0) {
    const result = await ensureOrgWorkspacesForUser(supabase, user.id);
    if (result && (result.orgWorkspacesCreated > 0 || result.membershipsAdded > 0)) {
      access = await resolveCrmAccess(supabase, user.id);
    }
  }

  // Always show Campaigns page; no redirect to home so nav stays consistent.
  if (access.orgWorkspaces.length === 0) {
    return (
      <div className="space-y-6">
        <header className="crm-page-header">
          <h1 className="crm-page-title">Campaigns</h1>
          <p className="crm-page-subtitle">
            Review creator delivery, submissions, and reports for your org.
          </p>
        </header>
        <div className="crm-surface-raised p-8 text-center max-w-xl">
          <p className="text-sm font-medium text-[var(--crm-foreground)] mb-1">
            No org workspace in CRM
          </p>
          <p className="text-sm text-[var(--crm-muted)] mb-6 max-w-sm mx-auto">
            Campaigns appear here when your Linkary org has a workspace linked in CRM. If you run campaigns from an org, your org admin can link it from the org workspace on Linkary. Use Tasks below for your personal task board.
          </p>
          <Link href="/tasks" className="crm-btn-primary no-underline">
            <ListTodo className="h-4 w-4" />
            Go to Tasks
          </Link>
        </div>
      </div>
    );
  }

  const campaigns = await fetchCampaignsForUser(supabase);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Campaigns</h1>
        <p className="crm-page-subtitle">
          Open a campaign to review submissions, compliance, and reports.
        </p>
      </header>

      {campaigns.length === 0 ? (
        <div className="crm-surface-card p-8 text-center text-[var(--crm-muted)] text-sm leading-relaxed max-w-lg">
          No campaigns yet. Create a campaign from your org workspace to get started.
        </div>
      ) : (
        <div className="crm-surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-banner-muted)]">
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
        </div>
      )}
    </div>
  );
}
