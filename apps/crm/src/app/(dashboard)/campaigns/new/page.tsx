import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { createCampaignDraftAction } from "./actions";

const ORG_WORKSPACE_TYPES = ["org", "project", "brand", "agency"] as const;

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) redirect("/login");

  const { data: workspaces } = await supabase
    .from("crm_workspaces")
    .select("id, slug, name, type")
    .in("type", ORG_WORKSPACE_TYPES)
    .order("created_at", { ascending: false });

  const list =
    (workspaces ?? []) as Array<{ id: string; slug: string | null; name: string | null; type: string }>;

  const sp = (await searchParams) ?? {};
  const errMsg = typeof sp.error === "string" ? sp.error : Array.isArray(sp.error) ? sp.error[0] : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--crm-muted)] hover:text-[var(--crm-primary)]"
      >
        â† Back to campaigns
      </Link>

      <header className="crm-page-header">
        <h1 className="crm-page-title">New campaign</h1>
        <p className="crm-page-subtitle">
          Create a draft campaign in CRM. You can edit full definition after creation and launch when ready.
        </p>
      </header>

      {errMsg ? (
        <div className="crm-surface-card p-4 text-sm border border-red-500/30 bg-red-500/5 text-red-700">
          {errMsg}
        </div>
      ) : null}

      {list.length === 0 ? (
        <div className="crm-surface-card p-6 text-sm text-[var(--crm-muted)] space-y-3">
          <p>No org/project workspaces are available in CRM for this user.</p>
          <p>Activation path: create or join an org workspace in Linkary, then return here to create your first draft campaign.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/campaigns" className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-4 py-2 text-sm font-medium text-[var(--crm-foreground)] hover:bg-[var(--crm-bg)] no-underline">
              Back to campaigns
            </Link>
            <a href="/" className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-4 py-2 text-sm font-medium text-[var(--crm-foreground)] hover:bg-[var(--crm-bg)] no-underline">
              Open Linkary
            </a>
          </div>
        </div>
      ) : (
        <form action={createCampaignDraftAction} className="crm-surface-card p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--crm-muted)] uppercase tracking-wide mb-1">
              Workspace (operator)
            </label>
            <select
              name="workspace_id"
              required
              className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm"
              defaultValue={list[0].id}
            >
              {list.map((w) => (
                <option key={w.id} value={w.id}>
                  {(w.name ?? w.slug ?? w.id.slice(0, 8) + "â€¦") + ` (${w.type})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--crm-muted)] uppercase tracking-wide mb-1">
              Title
            </label>
            <input
              name="title"
              required
              placeholder="e.g. March Creator Push"
              className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--crm-muted)] uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Short operator-facing summary"
              className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--crm-muted)] uppercase tracking-wide mb-1">
                Starts at
              </label>
              <input
                type="date"
                name="starts_at"
                className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--crm-muted)] uppercase tracking-wide mb-1">
                Ends at
              </label>
              <input
                type="date"
                name="ends_at"
                className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--crm-muted)] uppercase tracking-wide mb-1">
                Budget
              </label>
              <input
                type="number"
                step="0.01"
                name="budget"
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--crm-muted)] uppercase tracking-wide mb-1">
                Currency
              </label>
              <input
                name="currency"
                defaultValue="USD"
                className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" className="crm-btn-primary">
              Create draft
            </button>
            <Link
              href="/campaigns"
              className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-4 py-2 text-sm font-medium text-[var(--crm-foreground)] hover:bg-[var(--crm-bg)] no-underline"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}


