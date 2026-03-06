"use client";

import React, { useState } from "react";
import { Plus, Calendar, Mic, Handshake, Percent } from "lucide-react";
import { Button } from "../ui/button";
import { StatCard } from "../SharedComponents";
import { StatCardsRow } from "./StatCardsRow";
import type { MainNav } from "./XSpacesSidebar";

export type XSpacesAnalytics = {
  host: { hosted_spaces: number; sponsor_proposals_received: number; sponsor_proposals_accepted: number; sponsor_proposals_declined: number; sponsor_acceptance_rate: number | null };
  speaker: { applications: number; approved: number; declined: number; withdrawn: number; approval_rate: number | null };
  project: { proposals_sent: number; proposals_accepted: number; proposals_declined: number; proposals_pending: number; acceptance_rate: number | null };
  accepted_sponsorship_volume: number | null;
} | null;

type HomeTab = "my-events" | "analytics";
type EventFilter = "all" | "speaking" | "hosting";

export function HomeView({
  hostedCount,
  spokenCount,
  onAddEvent,
  onNavToExplore,
  eventListContent,
  emptyStateMessage = "No upcoming spaces yet.",
  showEmptyExploreCta = true,
  analytics = null,
  analyticsLoading = false,
}: {
  hostedCount?: number;
  spokenCount?: number;
  onAddEvent: () => void;
  onNavToExplore?: () => void;
  eventListContent: React.ReactNode;
  emptyStateMessage?: string;
  showEmptyExploreCta?: boolean;
  analytics?: XSpacesAnalytics;
  analyticsLoading?: boolean;
}) {
  const [tab, setTab] = useState<HomeTab>("my-events");
  const [filter, setFilter] = useState<EventFilter>("all");

  return (
    <div className="space-y-6">
      <StatCardsRow hostedCount={hostedCount} spokenCount={spokenCount} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-1 border-b border-border">
          {(["my-events", "analytics"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-colors ${
                tab === t
                  ? "bg-primary/10 text-primary border border-border border-b-0 -mb-px"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {t === "my-events" ? "My Events" : "Analytics"}
            </button>
          ))}
        </div>
        <Button onClick={onAddEvent} className="shrink-0">
          <Plus className="w-4 h-4" />
          Add Event
        </Button>
      </div>

      {tab === "my-events" && (
        <>
          <div className="flex flex-wrap gap-2">
            {(["all", "speaking", "hosting"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {f === "all" ? "All" : f === "speaking" ? "Speaking" : "Hosting"}
              </button>
            ))}
          </div>

          <div className="min-h-[200px]">
            {eventListContent ?? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <p className="text-muted-foreground mb-4">{emptyStateMessage}</p>
                {showEmptyExploreCta && onNavToExplore && (
                  <Button variant="outline" onClick={onNavToExplore}>
                    Explore
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "analytics" && (
        <div className="rounded-2xl border border-border bg-card p-6">
          {analyticsLoading && !analytics ? (
            <p className="text-muted-foreground text-center py-4">Loading…</p>
          ) : analytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Hosted Spaces" value={String(analytics.host.hosted_spaces)} icon={Calendar} variant="light" />
              <StatCard label="Speaker Approval Rate" value={analytics.speaker.approval_rate != null ? `${Math.round(analytics.speaker.approval_rate * 100)}%` : "—"} icon={Mic} variant="light" />
              <StatCard label="Sponsor Proposals Accepted" value={String(analytics.host.sponsor_proposals_accepted)} icon={Handshake} variant="light" />
              <StatCard label="Sponsor Acceptance Rate" value={analytics.host.sponsor_acceptance_rate != null ? `${Math.round(analytics.host.sponsor_acceptance_rate * 100)}%` : "—"} icon={Percent} variant="light" />
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">Analytics unavailable.</p>
          )}
        </div>
      )}
    </div>
  );
}
