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
  return (
    <div className="rounded-xl border border-border bg-card p-4">
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
          {(description || impactSummary) && (
            <p className="mt-2 text-sm text-foreground">
              {impactSummary ?? description}
            </p>
          )}
          {engagementDeltaPercent != null && Number.isFinite(engagementDeltaPercent) && (
            <p className="mt-1 text-xs text-primary">
              Engagement delta: {engagementDeltaPercent > 0 ? "+" : ""}
              {engagementDeltaPercent}%
            </p>
          )}
          {proofUrl && (
            <a
              href={proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              Proof
            </a>
          )}
          {metrics && Object.keys(metrics).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {Object.entries(metrics).map(([k, v]) =>
                v != null && v !== "" ? (
                  <span key={k}>
                    {k}: {String(v)}
                  </span>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
