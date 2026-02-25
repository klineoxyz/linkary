"use client";

import React from "react";
import { EmptyStateCard } from "./EmptyStateCard";
import { MessageCircle } from "lucide-react";

export interface MentionsCardProps {
  mentions: unknown[];
  emptyMessage?: string;
}

export function MentionsCard({
  mentions,
  emptyMessage = "Coming soon (twitterapi.io mentions)",
}: MentionsCardProps) {
  if (mentions.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
        <h3 className="text-sm font-semibold text-white/90">Mentions (last week)</h3>
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
