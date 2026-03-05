"use client";

import React from "react";
import { Mic, Calendar, CalendarX, Users, Headphones, Star } from "lucide-react";
import { StatCard } from "../SharedComponents";

const STATS = [
  { key: "spoken", label: "Spoken On", icon: Mic, value: "—" },
  { key: "hosted", label: "Hosted Events", icon: Calendar, value: "—" },
  { key: "missed", label: "Missed Events", icon: CalendarX, value: "—" },
  { key: "reach", label: "Upcoming Reach", icon: Users, value: "—" },
  { key: "listeners", label: "Total Listeners", icon: Headphones, value: "—" },
  { key: "ratings", label: "My Ratings", icon: Star, value: "—" },
] as const;

export function StatCardsRow({
  hostedCount,
  spokenCount,
}: {
  hostedCount?: number;
  spokenCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {STATS.map(({ key, label, icon: Icon, value: fallback }) => {
        let value: string | number = fallback;
        if (key === "hosted" && hostedCount != null) value = String(hostedCount);
        if (key === "spoken" && spokenCount != null) value = String(spokenCount);
        return (
          <StatCard
            key={key}
            label={label}
            value={value}
            icon={Icon}
            variant="light"
          />
        );
      })}
    </div>
  );
}
