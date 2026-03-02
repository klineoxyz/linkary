"use client";

import React from "react";
import { KpiCard } from "./KpiCard";
import type { KpiCardData } from "./types";

export interface KpiGridProps {
  cards: KpiCardData[];
  loading?: boolean;
}

export function KpiGrid({ cards, loading }: KpiGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" data-page="analytics">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
            <div className="h-3 w-16 bg-muted/80 rounded mb-2" />
            <div className="h-7 w-20 bg-muted/80 rounded mb-1.5" />
            <div className="h-3 w-full max-w-[80%] bg-muted/60 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" data-page="analytics">
      {cards.map((card) => (
        <KpiCard key={card.id} data={card} />
      ))}
    </div>
  );
}
