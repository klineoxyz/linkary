"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { GrowthTrajectoryPoint } from "@/lib/report";

function shortDayLabel(isoDay: string): string {
  const s = isoDay.trim();
  const d = /\d{4}-\d{2}-\d{2}/.test(s) ? new Date(`${s}T12:00:00.000Z`) : new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function xTickIndices(n: number): number[] {
  if (n <= 1) return [0];
  const maxTicks = Math.min(6, n);
  const out: number[] = [];
  for (let k = 0; k < maxTicks; k++) {
    out.push(Math.round((k / (maxTicks - 1)) * (n - 1)));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Compact tick labels for large cumulative counts */
function fmtAxis(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const v = Math.round(n);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 10_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString();
}

function spanSafe(min: number, max: number): number {
  return Math.max(max - min, 1);
}

export function GrowthTrajectoryChart({ series }: { series: GrowthTrajectoryPoint[] }) {
  const uid = useId().replace(/:/g, "");
  const gradId = `growthTrajEngFill-${uid}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverI, setHoverI] = useState<number | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const w = 720;
  const h = 292;
  const padL = 56;
  const padR = 56;
  const padT = 18;
  const padB = 56;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const rightSpineX = w - padR + 4;

  const onSvgMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (series.length === 0) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const xSvg = ((e.clientX - rect.left) / rect.width) * w;
      if (xSvg < padL || xSvg > w - padR) {
        setHoverI(null);
        setTipPos(null);
        return;
      }
      const n = series.length;
      const t = (xSvg - padL) / innerW;
      const i = Math.min(n - 1, Math.max(0, Math.round(t * (n <= 1 ? 0 : n - 1))));
      setHoverI(i);
      const br = wrapRef.current?.getBoundingClientRect();
      if (br) setTipPos({ x: e.clientX - br.left, y: e.clientY - br.top });
    },
    [series.length, innerW, padL, padR, w]
  );

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

  const eng = series.map((p) => p.cumulative_engagements);
  const views = series.map((p) => p.cumulative_views);
  const hasMindshare = series.some((p) => p.mindshare_score != null);
  const thirdLabel = hasMindshare ? "Mindshare index (ingested daily)" : "Cumulative posts";
  const thirdVals: (number | null)[] = hasMindshare
    ? series.map((p) => p.mindshare_score)
    : series.map((p) => p.cumulative_posts);

  const engMin = Math.min(...eng);
  const engMax = Math.max(...eng);
  const spanEng = spanSafe(engMin, engMax);
  const yEng = (v: number) => padT + innerH - ((v - engMin) / spanEng) * innerH;

  const vMin = Math.min(...views);
  const vMax = Math.max(...views);
  const spanV = spanSafe(vMin, vMax);
  const yView = (v: number) => padT + innerH - ((v - vMin) / spanV) * innerH;

  let yThird: (v: number) => number;
  let thirdMin: number;
  let thirdMax: number;
  if (hasMindshare) {
    const finite = thirdVals.filter((x): x is number => x != null && Number.isFinite(x));
    thirdMin = finite.length ? Math.min(...finite) : 0;
    thirdMax = finite.length ? Math.max(...finite) : 1;
    const spanT = spanSafe(thirdMin, thirdMax);
    yThird = (v: number) => padT + innerH - ((v - thirdMin) / spanT) * innerH;
  } else {
    const posts = thirdVals as number[];
    thirdMin = Math.min(...posts);
    thirdMax = Math.max(...posts);
    const spanP = spanSafe(thirdMin, thirdMax);
    yThird = (v: number) => padT + innerH - ((v - thirdMin) / spanP) * innerH;
  }

  function pathEngAbs(): string {
    let d = "";
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yEng(eng[i]);
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return d;
  }

  function pathViewAbs(): string {
    let d = "";
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yView(views[i]);
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return d;
  }

  function pathThirdAbs(): string {
    let d = "";
    let pen = false;
    for (let i = 0; i < n; i++) {
      const raw = thirdVals[i];
      if (raw == null || !Number.isFinite(Number(raw))) {
        pen = false;
        continue;
      }
      const v = Number(raw);
      const x = xAt(i);
      const y = yThird(v);
      if (!pen) {
        d += `M ${x} ${y}`;
        pen = true;
      } else {
        d += ` L ${x} ${y}`;
      }
    }
    return d;
  }

  const pathEng = pathEngAbs();
  const pathView = pathViewAbs();
  const pathThird = pathThirdAbs();

  const baseY = padT + innerH;
  const lastX = xAt(n - 1);
  const firstX = xAt(0);
  const areaEng = pathEng.length > 0 ? `${pathEng} L ${lastX} ${baseY} L ${firstX} ${baseY} Z` : "";

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

  const xTicks = xTickIndices(n);
  const axisStroke = "var(--crm-border)";
  const tickStroke = "var(--crm-border)";
  const labelFill = "var(--crm-muted)";

  /** Horizontal grid + left ticks: tied to engagement scale */
  const engTickVals = [engMax, engMin + spanEng / 2, engMin];

  const viewTickVals = [vMax, vMin + spanV / 2, vMin];

  const hi = hoverI != null ? series[hoverI] : null;
  const hiX = hoverI != null ? xAt(hoverI) : null;
  const hiEngY = hoverI != null ? yEng(eng[hoverI]) : null;

  return (
    <div ref={wrapRef} className="relative rounded-2xl border-2 border-[color-mix(in_srgb,var(--crm-primary)_28%,var(--crm-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--crm-primary)_8%,var(--crm-card))_0%,color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))_100%)] p-5 shadow-md">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-[var(--crm-foreground)]">Cumulative growth trajectory</p>
          <p className="text-xs text-[var(--crm-muted)] mt-0.5">
            Layer 1 — left axis: cumulative engagements; right axis: cumulative views; green line uses its own scale ({thirdLabel}
            ). Hover for exact values.
          </p>
        </div>
        {engBadge ? (
          <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--crm-primary)_14%,var(--crm-card))] px-3 py-1 text-[11px] font-semibold text-[var(--crm-foreground)]">
            {engBadge}
          </span>
        ) : null}
      </div>
      <div className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--crm-border)_70%,transparent)] bg-[var(--crm-bg)] p-3">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-[min(20rem,52vw)] w-full min-h-[220px] cursor-crosshair"
          role="img"
          aria-label="Cumulative trajectory: engagements and views on absolute scales"
          onMouseMove={onSvgMove}
          onMouseLeave={() => {
            setHoverI(null);
            setTipPos(null);
          }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={w} height={h} fill="transparent" />
          {engTickVals.map((ev) => {
            const y = yEng(ev);
            return (
              <line
                key={`grid-${ev}`}
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke={axisStroke}
                strokeOpacity={0.38}
                strokeWidth={1}
              />
            );
          })}
          {areaEng ? <path d={areaEng} fill={`url(#${gradId})`} /> : null}
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
          {hiX != null && hoverI != null ? (
            <line
              x1={hiX}
              x2={hiX}
              y1={padT}
              y2={baseY}
              stroke="var(--crm-primary)"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.85}
            />
          ) : null}
          {hoverI != null && hiEngY != null ? (
            <circle cx={xAt(hoverI)} cy={hiEngY} r={5} fill="#2563eb" stroke="var(--crm-card)" strokeWidth={2} />
          ) : null}
          <line x1={padL} y1={padT} x2={padL} y2={baseY} stroke={axisStroke} strokeWidth={1.35} />
          {engTickVals.map((ev) => {
            const y = yEng(ev);
            return (
              <g key={`yle-${ev}`}>
                <line x1={padL - 5} y1={y} x2={padL} y2={y} stroke={tickStroke} strokeWidth={1.1} />
                <text
                  x={padL - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill={labelFill}
                  style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}
                >
                  {fmtAxis(ev)}
                </text>
              </g>
            );
          })}
          <text
            x={12}
            y={padT + innerH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            fill={labelFill}
            transform={`rotate(-90, 12, ${padT + innerH / 2})`}
            style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}
          >
            Engagements
          </text>
          <line x1={rightSpineX} y1={padT} x2={rightSpineX} y2={baseY} stroke={axisStroke} strokeWidth={1.35} />
          {viewTickVals.map((vv) => {
            const y = yView(vv);
            return (
              <g key={`yr-${vv}`}>
                <line x1={rightSpineX} y1={y} x2={rightSpineX + 5} y2={y} stroke={tickStroke} strokeWidth={1.1} />
                <text
                  x={rightSpineX + 8}
                  y={y}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill={labelFill}
                  style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}
                >
                  {fmtAxis(vv)}
                </text>
              </g>
            );
          })}
          <text
            x={w - 10}
            y={padT + innerH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            fill={labelFill}
            transform={`rotate(90, ${w - 10}, ${padT + innerH / 2})`}
            style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}
          >
            Views
          </text>
          <line x1={padL} y1={baseY} x2={w - padR} y2={baseY} stroke={axisStroke} strokeWidth={1.35} />
          {xTicks.map((i) => {
            const x = xAt(i);
            const lbl = shortDayLabel(series[i].day);
            return (
              <g key={`xt-${i}-${series[i].day}`}>
                <line x1={x} y1={baseY} x2={x} y2={baseY + 5} stroke={tickStroke} strokeWidth={1.1} />
                <text
                  x={x}
                  y={baseY + 18}
                  textAnchor="middle"
                  fontSize={9}
                  fill={labelFill}
                  style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}
                >
                  {lbl}
                </text>
              </g>
            );
          })}
          <text
            x={padL + innerW / 2}
            y={h - 8}
            textAnchor="middle"
            fontSize={9}
            fill={labelFill}
            style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}
          >
            Ingested calendar day
          </text>
        </svg>
        {hi && tipPos ? (
          <div
            className="pointer-events-none absolute z-10 max-w-[17rem] rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2 text-[11px] shadow-lg"
            style={{
              left: Math.min(Math.max(tipPos.x + 12, 8), (wrapRef.current?.offsetWidth ?? 400) - 280),
              top: Math.max(tipPos.y - 8, 8),
            }}
          >
            <p className="font-semibold text-[var(--crm-foreground)]">{hi.day}</p>
            <p className="mt-1 text-[var(--crm-muted)]">
              <span className="text-[#2563eb] font-medium">Eng.</span> {hi.cumulative_engagements.toLocaleString()} cumulative
            </p>
            <p className="text-[var(--crm-muted)]">
              <span className="text-[#fb923c] font-medium">Views</span> {hi.cumulative_views.toLocaleString()} cumulative
            </p>
            <p className="text-[var(--crm-muted)]">
              <span className="text-[#34d399] font-medium">Posts</span> {hi.cumulative_posts.toLocaleString()} cumulative
            </p>
            {hasMindshare ? (
              <p className="text-[var(--crm-muted)]">
                <span className="font-medium text-[var(--crm-foreground)]">Mindshare</span>{" "}
                {hi.mindshare_score != null ? hi.mindshare_score.toLocaleString() : "—"}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[var(--crm-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-[#2563eb]" aria-hidden />
          Cumulative engagements (left scale)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-[#fb923c]" aria-hidden />
          Cumulative views (right scale)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm bg-[#34d399]" aria-hidden />
          {thirdLabel} (own min–max)
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--crm-muted)]">
        <strong className="text-[var(--crm-foreground)]">Left Y-axis</strong> is cumulative engagements (absolute).{" "}
        <strong className="text-[var(--crm-foreground)]">Right Y-axis</strong> is cumulative views (absolute). The green line uses its own
        vertical range so it stays visible next to much larger view counts. {!hasMindshare ? (
          <>
            <strong className="text-[var(--crm-foreground)]">Mindshare</strong> replaces posts when{" "}
            <code className="text-[9px] bg-[var(--crm-bg)] px-1 rounded">mindshare_score</code> is ingested.
          </>
        ) : (
          <>Dashed green segments skip days without a mindshare value.</>
        )}
      </p>
    </div>
  );
}
