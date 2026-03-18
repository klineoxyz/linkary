"use client";

/**
 * Shown when NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing.
 * CRM runs from apps/crm and does not load the repo root .env — add env in apps/crm.
 */
export function SetupRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--crm-page-bg)] p-4">
      <div className="crm-surface-raised w-full max-w-md p-6 sm:p-8">
        <h1 className="text-lg font-semibold text-[var(--crm-foreground)] mb-2">
          Supabase not configured
        </h1>
        <p className="text-sm text-[var(--crm-muted)] mb-4">
          The CRM app needs the same Supabase project as Linkary. Add these to{" "}
          <code className="rounded-[var(--crm-radius)] bg-[var(--crm-banner-muted)] border border-[var(--crm-border)] px-1.5 py-0.5 text-xs">
            apps/crm/.env.local
          </code>
          :
        </p>
        <pre className="rounded-[var(--crm-radius)] bg-[var(--crm-banner-muted)] border border-[var(--crm-border)] p-3 text-xs text-[var(--crm-foreground)] overflow-x-auto mb-4">
          {`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
        <p className="text-xs text-[var(--crm-muted)]">
          Use the same values as in your main Linkary app (e.g. <code className="rounded bg-[var(--crm-border)] px-1 py-0.5">apps/web/.env.local</code>). Then restart <code className="rounded bg-[var(--crm-border)] px-1 py-0.5">pnpm --filter crm dev</code>.
        </p>
      </div>
    </div>
  );
}
