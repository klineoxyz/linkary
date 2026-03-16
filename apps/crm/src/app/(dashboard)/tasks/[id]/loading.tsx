export default function TaskDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-24 rounded bg-[var(--crm-border)] animate-pulse" />
      <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6">
        <div className="h-7 w-3/4 rounded bg-[var(--crm-border)] animate-pulse mb-4" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-[var(--crm-border)] animate-pulse" />
          <div className="h-4 w-48 rounded bg-[var(--crm-border)] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
