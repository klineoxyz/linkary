import type { GrowthTrajectoryPoint } from "@/lib/report";

function normalizeSeries(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span <= 0) return values.map(() => 0.5);
  return values.map((v) => (v - min) / span);
}

function normalizeNullable(values: (number | null)[]): (number | null)[] {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length === 0) return values.map(() => null);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min;
  if (span <= 0) return values.map((v) => (v != null ? 0.5 : null));
  return values.map((v) => (v == null || !Number.isFinite(v) ? null : (v - min) / span));
}

export function GrowthTrajectoryChart({ series }: { series: GrowthTrajectoryPoint[] }) {
  const w = 720;
  const h = 292;
  const padL = 44;
  const padR = 12;
  const padT = 18;
  const padB = 56;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  if (series.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))] p-6 text-center text-sm text-[var(--crm-muted)]">
        Growth trajectory needs daily metrics rows. Sync{" "}
        <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">crm_campaign_metrics_daily</code> first.
      </div>
    );
  }

  const n = series.length;
  const xAt = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (t: number) => padT + innerH - t * innerH;

  const eng = series.map((p) => p.cumulative_engagements);
  const views = series.map((p) => p.cumulative_views);
  const hasMindshare = series.some((p) => p.mindshare_score != null);
  const thirdLabel = hasMindshare ? "Mindshare index (ingested daily)" : "Cumulative posts";
  const thirdVals: (number | null)[] = hasMindshare
    ? series.map((p) => p.mindshare_score)
    : series.map((p) => p.cumulative_posts);

  const engN = normalizeSeries(eng);
  const viewN = normalizeSeries(views);
  const thirdN = hasMindshare ? normalizeNullable(thirdVals) : normalizeSeries(thirdVals as number[]);

  function pathLine(ty: number[]): string {
    if (n === 0) return "";
    let d = "";
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yAt(ty[i]);
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return d;
  }

  function pathLineNullable(ty: (number | null)[]): string {
    let d = "";
    let pen = false;
    for (let i = 0; i < n; i++) {
      const t = ty[i];
      if (t == null) {
        pen = false;
        continue;
      }
      const x = xAt(i);
      const y = yAt(t);
      if (!pen) {
        d += `M ${x} ${y}`;
        pen = true;
      } else {
        d += ` L ${x} ${y}`;
      }
    }
    return d;
  }

  const pathEng = pathLine(engN);
  const pathView = pathLine(viewN);
  const pathThird = hasMindshare ? pathLineNullable(thirdN as (number | null)[]) : pathLine(thirdN as number[]);

  const baseY = padT + innerH;
  const lastX = xAt(n - 1);
  const firstX = xAt(0);
  const areaEng =
    pathEng.length > 0 ? `${pathEng} L ${lastX} ${baseY} L ${firstX} ${baseY} Z` : "";

  const firstDay = series[0].day;
  const lastDay = series[n - 1].day;
  const firstE = series[0].cumulative_engagements;
  const lastE = series[n - 1].cumulative_engagements;
  const engBadge =
    firstE > 0
      ? `${((lastE - firstE) / firstE) * 100 >= 0 ? "+" : ""}${Math.round(((lastE - firstE) / firstE) * 100)}% cumulative engagements (${firstDay}→${lastDay})`
      : lastE > 0
        ? `Cumulative engagements: ${lastE.toLocaleString()} by ${lastDay} (was 0 on first ingested day)`
        : null;

  return (
    <div className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--crm-primary)_28%,var(--crm-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--crm-primary)_8%,var(--crm-card))_0%,color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))_100%)] p-5 shadow-md">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-[var(--crm-foreground)]">Cumulative growth trajectory</p>
          <p className="text-xs text-[var(--crm-muted)] mt-0.5">
            Layer 1 — running totals of views and engagements per ingested day; third line is mindshare when populated, otherwise cumulative posts.
          </p>
        </div>
        {engBadge ? (
          <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--crm-primary)_14%,var(--crm-card))] px-3 py-1 text-[11px] font-semibold text-[var(--crm-foreground)]">
            {engBadge}
          </span>
        ) : null}
      </div>
      <div className="mt-4 rounded-xl bg-[var(--crm-bg)] p-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full" role="img" aria-label="Normalized cumulative trajectory chart">
          <defs>
            <linearGradient id="growthTrajEngFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((t) => {
            const y = yAt(t);
            return (
              <line
                key={t}
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-[var(--crm-border)]"
                strokeOpacity={0.45}
                strokeWidth={1}
              />
            );
          })}
          {areaEng ? <path d={areaEng} fill="url(#growthTrajEngFill)" /> : null}
          {pathView ? (
            <path
              d={pathView}
              fill="none"
              stroke="#fb923c"
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {pathThird ? (
            <path
              d={pathThird}
              fill="none"
              stroke="#34d399"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={hasMindshare ? "6 4" : undefined}
            />
          ) : null}
          {pathEng ? (
            <path
              d={pathEng}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[var(--crm-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-[#2563eb]" aria-hidden />
          Cumulative engagements
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-[#fb923c]" aria-hidden />
          Cumulative views
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-[#34d399]" aria-hidden />
          {thirdLabel}
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--crm-muted)]">
        Axis is <strong className="text-[var(--crm-foreground)]">min–max normalized per series</strong> so shapes are comparable; use KPI cards and tables above for absolute totals.{" "}
        {!hasMindshare ? (
          <>
            <strong className="text-[var(--crm-foreground)]">Mindshare</strong> appears as the third line when{" "}
            <code className="text-[9px] bg-[var(--crm-bg)] px-1 rounded">mindshare_score</code> is ingested on daily rows.
          </>
        ) : (
          <>
            Third line uses only days with a non-null mindshare value; gaps mean no index for that day.
          </>
        )}
      </p>
    </div>
  );
}
