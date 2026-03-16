export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded-lg bg-[var(--crm-border)] animate-pulse" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-9 w-24 rounded-lg bg-[var(--crm-border)] animate-pulse" />
        ))}
      </div>
      <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] divide-y divide-[var(--crm-border)]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <div className="h-5 flex-1 max-w-xs rounded bg-[var(--crm-border)] animate-pulse" />
            <div className="h-5 w-20 rounded bg-[var(--crm-border)] animate-pulse" />
            <div className="h-5 w-24 rounded bg-[var(--crm-border)] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
