import { createServerSupabase } from "@/lib/supabase/server";

export default async function TasksPage() {
  const supabase = await createServerSupabase();
  // TODO: load crm_boards + crm_tasks for current workspace (M3)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--crm-primary)]">Tasks</h1>
      <p className="text-sm text-[var(--crm-muted)]">
        Your task board will appear here. Creator: manual tasks + campaign bundles. Org: campaign ops tasks.
      </p>
      <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-8 text-center text-[var(--crm-muted)]">
        Task board MVP (M3) — no CRM tables yet.
      </div>
    </div>
  );
}
