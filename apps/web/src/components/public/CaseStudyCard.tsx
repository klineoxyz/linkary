"use client";

type CaseStudyCardProps = {
  title?: string | null;
  description?: string | null;
  proofUrl?: string | null;
  metrics?: Record<string, unknown> | null;
  createdAt: string;
  projectLogo?: string | null;
  impactSummary?: string | null;
  engagementDeltaPercent?: number | null;
};

export function CaseStudyCard({
  title,
  description,
  proofUrl,
  metrics,
  createdAt,
  projectLogo,
  impactSummary,
  engagementDeltaPercent,
}: CaseStudyCardProps) {
  const dateLabel = createdAt ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : null;
  const firstMetric = metrics && Object.keys(metrics).length > 0
    ? Object.entries(metrics).find(([, v]) => v != null && v !== "")
    : null;
  const resultValue = engagementDeltaPercent != null && Number.isFinite(engagementDeltaPercent)
    ? `${engagementDeltaPercent > 0 ? "+" : ""}${engagementDeltaPercent}%`
    : firstMetric ? String(firstMetric[1]) : null;
  const resultLabel = engagementDeltaPercent != null && Number.isFinite(engagementDeltaPercent)
    ? "Engagement delta"
    : firstMetric ? firstMetric[0] : null;

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start gap-3">
        {projectLogo && (
          <img
            src={projectLogo}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          {title && <h4 className="font-semibold text-foreground">{title}</h4>}
          {dateLabel && (
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
          )}
          {resultValue != null && resultLabel && (
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {resultValue}
            </p>
          )}
          {(description || impactSummary) && (
            <p className="mt-1 text-sm text-foreground">
              {impactSummary ?? description}
            </p>
          )}
          {proofUrl && (
            <a
              href={proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent hover:text-primary"
            >
              View proof
            </a>
          )}
          {metrics && Object.keys(metrics).length > 1 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {Object.entries(metrics)
                .filter(([, v]) => v != null && v !== "")
                .slice(1)
                .map(([k, v]) => (
                  <span key={k}>
                    {k}: {String(v)}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
