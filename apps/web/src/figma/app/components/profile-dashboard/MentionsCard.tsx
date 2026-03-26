"use client";

import React from "react";
import { EmptyStateCard } from "./EmptyStateCard";
import { MessageCircle } from "lucide-react";

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export interface MentionsCardProps {
  mentions: unknown[];
  emptyMessage?: string;
  cacheStatus?: "hit" | "miss" | "stale";
  updatedAt?: string | null;
}

export function MentionsCard({
  mentions,
  emptyMessage = "Coming soon (X mentions)",
  cacheStatus,
  updatedAt,
}: MentionsCardProps) {
  const statusLine =
    cacheStatus === "stale"
      ? "Data is stale, refreshing soon"
      : cacheStatus === "miss"
        ? "No data yet. Sync will run automatically."
        : updatedAt
          ? `Updated: ${relativeTime(updatedAt)}`
          : null;

  if (mentions.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
        <h3 className="text-sm font-semibold text-white/90">Mentions (last week)</h3>
        {statusLine && <p className="mt-1 text-xs text-white/50">{statusLine}</p>}
        <EmptyStateCard
          title="No mentions yet"
          message={emptyMessage}
          icon={<MessageCircle className="h-10 w-10" />}
          className="mt-3 border-0 bg-transparent p-0"
        />
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
      <h3 className="text-sm font-semibold text-white/90">Mentions (last week)</h3>
      {statusLine && <p className="mt-1 text-xs text-white/50">{statusLine}</p>}
      <ul className="mt-3 space-y-2">
        {(mentions as Record<string, unknown>[]).map((m, i) => (
          <li key={i} className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
            {JSON.stringify(m)}
          </li>
        ))}
      </ul>
    </div>
  );
}
