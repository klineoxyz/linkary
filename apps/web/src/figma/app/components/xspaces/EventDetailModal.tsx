"use client";

import React from "react";
import { X, Calendar, Share2, MoreHorizontal, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import { CountdownTimers } from "./CountdownTimers";

export type HostProfile = {
  id: string;
  display_name: string | null;
  twitter_username: string | null;
  profile_image_url: string | null;
};

export type SpaceDetail = {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_mins: number | null;
  status: string;
  x_space_url?: string | null;
  host?: HostProfile | null;
};

export type EventDetailModalProps = {
  space: SpaceDetail;
  host?: HostProfile | null;
  speakers: HostProfile[];
  combinedFollowers?: string | null;
  isHost: boolean;
  onClose: () => void;
  /** Left column: main CTA (e.g. Request speaker, Save, or Going) */
  primaryAction?: React.ReactNode;
  /** Additional actions row (e.g. Interested, Going, Request speaker) */
  extraActions?: React.ReactNode;
  /** Host-only section (edit, link X, speaker requests, etc.) */
  hostSection?: React.ReactNode;
  /** RSVP / attendees section */
  rsvpSection?: React.ReactNode;
  /** Open on X link - only if x_space_url exists; never pass tokens */
  openOnXUrl?: string | null;
  /** Countdown shown when scheduled_at is in the future */
  showCountdown?: boolean;
};

export function EventDetailModal({
  space,
  host,
  speakers,
  combinedFollowers,
  isHost,
  onClose,
  primaryAction,
  extraActions,
  hostSection,
  rsvpSection,
  openOnXUrl,
  showCountdown = true,
}: EventDetailModalProps) {
  const scheduledLabel = space.scheduled_at
    ? new Date(space.scheduled_at).toLocaleString("default", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not provided";
  const durationLabel = space.duration_mins ? `${space.duration_mins} min` : null;
  const hostName = host?.display_name?.trim() || (host?.twitter_username ? `@${host.twitter_username}` : "Not provided");

  return (
    <>
      <div
        className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-40"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl z-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-title"
      >
        {/* Top right actions */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {openOnXUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={openOnXUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                Open on X
              </a>
            </Button>
          )}
          <Button size="icon" variant="ghost" className="rounded-lg" title="Add to calendar">
            <Calendar className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="rounded-lg" title="Share">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="rounded-lg" title="More">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="rounded-lg" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-6 lg:gap-8">
          {/* Left column */}
          <div className="min-w-0 pr-8">
            <h2 id="event-detail-title" className="text-xl sm:text-2xl font-semibold text-foreground pr-24">
              {space.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {scheduledLabel}
              {durationLabel ? ` · ${durationLabel}` : ""}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                X Spaces
              </span>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                Roundtable
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {host?.profile_image_url ? (
                <img
                  src={host.profile_image_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium">
                  {hostName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{hostName}</p>
                <p className="text-xs text-muted-foreground">{combinedFollowers ?? "Not available"} combined followers</p>
              </div>
            </div>
            {space.description && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Description</h4>
                <p className="text-sm text-foreground">{space.description}</p>
              </div>
            )}
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Agenda</h4>
              <p className="text-sm text-muted-foreground">Not provided</p>
            </div>
            {hostSection}
            {rsvpSection}
            <div className="flex flex-wrap gap-2 mt-6">
              {primaryAction}
              {extraActions}
            </div>
          </div>

          {/* Right column: countdown, co-hosts, speakers */}
          <div className="space-y-6 border-t lg:border-t-0 lg:border-l border-border lg:pl-8 pt-6 lg:pt-0">
            {showCountdown && space.scheduled_at && new Date(space.scheduled_at) > new Date() && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Starts in</h4>
                <CountdownTimers scheduledAt={space.scheduled_at} />
              </div>
            )}
            {speakers.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Speakers</h4>
                <div className="flex flex-wrap gap-2">
                  {speakers.slice(0, 8).map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      {s.profile_image_url ? (
                        <img
                          src={s.profile_image_url}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                          {(s.display_name?.trim().slice(0, 2) || s.twitter_username?.slice(0, 2) || "?").toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Combined followers</h4>
              <p className="text-sm font-medium text-foreground">{combinedFollowers ?? "Not available"}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
