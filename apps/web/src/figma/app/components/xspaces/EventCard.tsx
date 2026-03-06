"use client";

import React from "react";
import { Clock } from "lucide-react";
import { Button } from "../ui/button";

export type HostProfile = {
  id: string;
  display_name: string | null;
  twitter_username: string | null;
  profile_image_url: string | null;
};

export type SpaceForCard = {
  id: string;
  title: string;
  linkary_title?: string | null;
  scheduled_at: string | null;
  duration_mins: number | null;
  status: string;
  host?: HostProfile | null;
  description?: string | null;
};

function displayTitle(space: SpaceForCard): string {
  return (space.linkary_title?.trim() || space.title) ?? "";
}

function formatTimeRange(scheduled_at: string | null, duration_mins: number | null) {
  if (!scheduled_at) return "—";
  const start = new Date(scheduled_at);
  const end = duration_mins
    ? new Date(start.getTime() + duration_mins * 60 * 1000)
    : null;
  const startStr = start.toLocaleTimeString("default", { hour: "numeric", minute: "2-digit" });
  const endStr = end?.toLocaleTimeString("default", { hour: "numeric", minute: "2-digit" });
  return endStr ? `${startStr} – ${endStr}` : startStr;
}

export function EventCard({
  space,
  onRequest,
  onEventPage,
  onClick,
}: {
  space: SpaceForCard;
  onRequest?: () => void;
  onEventPage?: () => void;
  onClick?: () => void;
}) {
  const host = space.host;
  const hostName = host?.display_name?.trim() || (host?.twitter_username ? `@${host.twitter_username}` : "Host");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if ((e.target as HTMLElement)?.tagName === "BUTTON") return;
        e.preventDefault();
        onClick?.();
      }}
      className="p-4 sm:p-5 rounded-2xl border border-border bg-card hover:border-primary/20 hover:shadow-md transition-all cursor-pointer text-left"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <Clock className="w-4 h-4" />
          <span>{formatTimeRange(space.scheduled_at, space.duration_mins)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{displayTitle(space)}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              X Spaces
            </span>
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
              Roundtable
            </span>
          </div>
          {host && (
            <p className="text-sm text-muted-foreground mt-2 truncate">{hostName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">Combined followers: —</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {onRequest && (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onRequest(); }}>
            Request
          </Button>
        )}
        {onEventPage && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onEventPage(); }}>
            Event Page
          </Button>
        )}
      </div>
    </div>
  );
}
