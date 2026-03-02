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
      <div className="rounded-xl border border-border bg-card p-4" data-page="analytics">
        <h3 className="text-sm font-semibold text-foreground mb-2">Top Drivers (30D)</h3>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" data-page="analytics">
      <div className="px-4 py-2.5 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Top Drivers (30D)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Posts that drove the most engagement. ER = (likes + replies + reposts) / followers.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-card sticky top-0 z-10">
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 bg-card">Date</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 bg-card">Likes</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 bg-card">Replies</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 bg-card">Reposts</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 bg-card">ER %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.tweet_id ?? index} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                <td className="py-2.5 px-4 font-medium text-foreground">
                  {row.date}
                  {row.time ? ` · ${row.time}` : ""}
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1 justify-end text-muted-foreground">
                    <Heart className="w-3 h-3 opacity-70" />
                    {row.likes.toLocaleString()}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1 justify-end text-muted-foreground">
                    <MessageSquare className="w-3 h-3 opacity-70" />
                    {row.replies.toLocaleString()}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1 justify-end text-muted-foreground">
                    <Repeat className="w-3 h-3 opacity-70" />
                    {row.reposts.toLocaleString()}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right font-medium tabular-nums text-foreground">
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
