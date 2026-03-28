"use client";

import { useCallback, useRef, useState } from "react";

export type MiniBarPoint = { key: string; views: number; engagements: number; posts: number };

export function InteractiveMiniBars({
  title,
  subtitle,
  points,
  valueKey,
  color,
  emphasize = false,
}: {
  title: string;
  subtitle?: string;
  points: MiniBarPoint[];
  valueKey: "views" | "engagements" | "posts";
  color: string;
  emphasize?: boolean;
}) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const data = points.slice(-16);
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const w = 720;
  const h = emphasize ? 190 : 160;
  const padX = 16;
  const padY = emphasize ? 16 : 14;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const step = innerW / Math.max(1, data.length);
  const bw = Math.max(6, Math.floor(step) - 6);
  const wrap = emphasize
    ? "rounded-3xl border-2 border-[color-mix(in_srgb,var(--crm-primary)_32%,var(--crm-border))] bg-[color-mix(in_srgb,var(--crm-primary)_7%,var(--crm-card))] p-5 shadow-md ring-1 ring-[color-mix(in_srgb,var(--crm-primary)_12%,transparent)]"
    : "rounded-2xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))] p-5 shadow-sm";

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const xSvg = ((e.clientX - rect.left) / rect.width) * w;
      if (xSvg < padX || xSvg > w - padX) {
        setHover(null);
        return;
      }
      const i = Math.min(data.length - 1, Math.max(0, Math.floor((xSvg - padX) / step)));
      setHover({
        i,
        x: e.clientX - (containerRef.current?.getBoundingClientRect().left ?? 0),
        y: e.clientY - (containerRef.current?.getBoundingClientRect().top ?? 0),
      });
    },
    [data.length, step, w, padX]
  );

  const hovered = hover != null ? data[hover.i] : null;
  const valueLabel = valueKey === "views" ? "Views" : valueKey === "engagements" ? "Engagements" : "Posts";

  return (
    <div ref={containerRef} className={`relative ${wrap}`}>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <p className={`font-semibold text-[var(--crm-foreground)] ${emphasize ? "text-base" : "text-sm"}`}>{title}</p>
        {subtitle ? <p className="text-xs text-[var(--crm-muted)]">{subtitle}</p> : null}
      </div>
      <div className="mt-4 rounded-xl bg-[var(--crm-bg)] p-3 relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className={emphasize ? "h-44 w-full cursor-crosshair" : "h-36 w-full cursor-crosshair"}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <rect x="0" y="0" width={w} height={h} fill="transparent" />
          {data.map((d, i) => {
            const v = d[valueKey];
            const bh = Math.max(2, Math.round((v / max) * innerH));
            const x = padX + i * step + (step - bw) / 2;
            const y = h - padY - bh;
            const dim = hover != null && hover.i !== i;
            return (
              <rect
                key={`${d.key}-${valueKey}`}
                x={x}
                y={y}
                width={bw}
                height={bh}
                rx={3}
                fill={color}
                opacity={dim ? 0.35 : 1}
              />
            );
          })}
        </svg>
        {hovered && hover ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[10rem] max-w-[16rem] rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(hover.x + 12, 8), (containerRef.current?.offsetWidth ?? 300) - 180),
              top: Math.max(hover.y - 8, 8),
            }}
          >
            <p className="font-semibold text-[var(--crm-foreground)]">{hovered.key}</p>
            <p className="mt-1 tabular-nums text-[var(--crm-muted)]">
              <span className="text-[var(--crm-foreground)]">{valueLabel}:</span> {hovered[valueKey].toLocaleString()}
            </p>
            <p className="mt-0.5 tabular-nums text-[10px] text-[var(--crm-muted)]">
              Views {hovered.views.toLocaleString()} · Eng. {hovered.engagements.toLocaleString()} · Posts{" "}
              {hovered.posts.toLocaleString()}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
