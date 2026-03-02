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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 md:p-5 animate-pulse">
            <div className="h-3 w-20 bg-muted rounded mb-3" />
            <div className="h-8 w-24 bg-muted rounded mb-2" />
            <div className="h-3 w-full bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => (
        <KpiCard key={card.id} data={card} />
      ))}
    </div>
  );
}
