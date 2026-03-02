"use client";

import React from "react";
import { ChartCard } from "./ChartCard";

export function ChartSkeleton({ title = "Loading" }: { title?: string }) {
  return (
    <ChartCard title={title}>
      <div className="flex items-end gap-0.5 pl-6 pb-5 pt-1" style={{ minHeight: 152 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 min-w-[6px] max-w-[12px] rounded-t bg-muted/70 animate-pulse"
            style={{ height: `${30 + Math.sin(i * 0.5) * 40}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-0.5">
        <span className="bg-muted/60 rounded w-12 h-3 animate-pulse" />
        <span className="bg-muted/60 rounded w-12 h-3 animate-pulse" />
      </div>
    </ChartCard>
  );
}
