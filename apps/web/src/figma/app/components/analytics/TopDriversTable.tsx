"use client";

import React from "react";
import { Heart, MessageSquare, Repeat } from "lucide-react";
import type { TopDriverRow } from "./types";

export interface TopDriversTableProps {
  rows: TopDriverRow[];
  emptyMessage?: string;
}

export function TopDriversTable({ rows, emptyMessage = "No top drivers yet. Sync from Integrations to populate." }: TopDriversTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Top Drivers (30D)</h3>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Top Drivers (30D)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Posts that drove the most engagement. Engagement % = (likes + replies + reposts) / followers.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">Date</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">Likes</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">Replies</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">Reposts</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">ER %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.tweet_id ?? index} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-3 px-4 font-medium text-foreground">
                  {row.date}
                  {row.time ? ` · ${row.time}` : ""}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <Heart className="w-3.5 h-3.5 text-muted-foreground" />
                    {row.likes.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    {row.replies.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
                    {row.reposts.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-medium tabular-nums">
                  {row.engagementOver100 ? "100%+" : `${row.engagementRate}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
