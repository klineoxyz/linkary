"use client";

import React, { useState } from "react";
import { FiltersRail } from "./FiltersRail";
import { EventCard } from "./EventCard";
import type { SpaceForCard } from "./EventCard";

export function ExploreView({
  spaces,
  onSpaceClick,
  onRequest,
}: {
  spaces: SpaceForCard[];
  onSpaceClick: (space: SpaceForCard) => void;
  onRequest?: (space: SpaceForCard) => void;
}) {
  const [sortBy, setSortBy] = useState("Recent");
  const [selectDate, setSelectDate] = useState("");

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
      <FiltersRail />

      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Events</h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectDate}
              onChange={(e) => setSelectDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-input-background text-foreground text-sm"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-input-background text-foreground text-sm"
            >
              <option value="Recent">Sort by: Recent</option>
              <option value="Soon">Soon</option>
              <option value="Popular">Popular</option>
            </select>
          </div>
        </div>

        {spaces.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No public spaces yet. Invite others.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {spaces.map((s) => (
              <EventCard
                key={s.id}
                space={s}
                onClick={() => onSpaceClick(s)}
                onEventPage={() => onSpaceClick(s)}
                onRequest={onRequest ? () => onRequest(s) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
