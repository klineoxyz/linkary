export type OpsConfidence = "exact" | "proxy" | "estimated" | "not_computed";

const styles: Record<OpsConfidence, string> = {
  exact: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30",
  proxy: "bg-amber-500/15 text-amber-900 border-amber-500/35",
  estimated: "bg-sky-500/15 text-sky-900 border-sky-500/30",
  not_computed: "bg-[var(--crm-banner-muted)] text-[var(--crm-muted)] border-[var(--crm-border)]",
};

const labels: Record<OpsConfidence, string> = {
  exact: "Exact",
  proxy: "Proxy",
  estimated: "Estimated",
  not_computed: "Not computed",
};

export function OpsConfidenceBadge({
  kind,
  className = "",
}: {
  kind: OpsConfidence;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${styles[kind]} ${className}`}
    >
      {labels[kind]}
    </span>
  );
}

export function OpsConfidenceHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-[var(--crm-muted)] mt-1 leading-snug">{children}</p>;
}
