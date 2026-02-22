"use client";

type MetricCardProps = {
  label: string;
  value: string | number;
  delta?: string | null;
  status?: "Good" | "Watch" | "Risk" | "Estimate" | null;
};

export function MetricCard({ label, value, delta, status }: MetricCardProps) {
  const hasStrongValue = value !== "—" && value !== "";
  return (
    <div className="rounded-md border border-border p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${hasStrongValue ? "text-primary" : "text-foreground"}`}>{value}</div>
      {(delta != null || status) && (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {delta != null && <span>{delta}</span>}
          {status && (
            <span
              className={
                status === "Good"
                  ? "text-primary"
                  : status === "Risk"
                    ? "text-muted-foreground"
                    : "text-foreground"
              }
            >
              {status}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
