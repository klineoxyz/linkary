"use client";

import { useRef, useState } from "react";

type Part = { key: string; label: string; value: number; color: string };

export function InteractiveCompositionBar({ title, parts }: { title: string; parts: Part[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const [hover, setHover] = useState<{ part: Part; x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  if (total <= 0) {
    return (
      <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-5 shadow-sm">
        <p className="text-sm font-semibold text-[var(--crm-foreground)]">{title}</p>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">No supported engagement breakdown available.</p>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-5 shadow-sm">
      <p className="text-sm font-semibold text-[var(--crm-foreground)]">{title}</p>
      <p className="mt-1 text-[11px] text-[var(--crm-muted)]">Hover a segment for counts.</p>
      <div
        className="mt-4 overflow-hidden rounded-full bg-[var(--crm-bg)] h-4 flex relative"
        onMouseLeave={() => setHover(null)}
      >
        {parts.map((p) => {
          const pct = (p.value / total) * 100;
          if (pct <= 0) return null;
          return (
            <button
              key={p.key}
              type="button"
              className="h-full min-w-[4px] cursor-crosshair border-0 p-0 transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--crm-primary)]"
              style={{ width: `${pct}%`, backgroundColor: p.color }}
              aria-label={`${p.label}: ${p.value.toLocaleString()} (${pct.toFixed(1)}%)`}
              onMouseEnter={(e) => {
                const r = wrapRef.current?.getBoundingClientRect();
                if (!r) return;
                setHover({ part: p, x: e.clientX - r.left, y: e.clientY - r.top });
              }}
              onMouseMove={(e) => {
                const r = wrapRef.current?.getBoundingClientRect();
                if (!r) return;
                setHover({ part: p, x: e.clientX - r.left, y: e.clientY - r.top });
              }}
            />
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--crm-muted)] sm:grid-cols-4">
        {parts.map((p) => (
          <div
            key={`${p.key}-legend`}
            className="flex items-center justify-between gap-2 rounded-lg bg-[var(--crm-bg)] px-2 py-1.5"
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-[var(--crm-foreground)]">{p.label}</span>
            </span>
            <span className="tabular-nums">{((p.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      {hover ? (
        <div
          className="pointer-events-none absolute z-10 min-w-[9rem] rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(hover.x + 8, 8), (wrapRef.current?.offsetWidth ?? 320) - 160),
            top: Math.min(Math.max(hover.y + 12, 8), (wrapRef.current?.offsetHeight ?? 200) - 72),
          }}
        >
          <p className="font-semibold text-[var(--crm-foreground)]">{hover.part.label}</p>
          <p className="mt-1 tabular-nums text-[var(--crm-muted)]">
            <span className="text-[var(--crm-foreground)]">{hover.part.value.toLocaleString()}</span> engagements
          </p>
          <p className="mt-0.5 tabular-nums text-[10px] text-[var(--crm-muted)]">
            {((hover.part.value / total) * 100).toFixed(1)}% of bar total
          </p>
        </div>
      ) : null}
    </div>
  );
}
