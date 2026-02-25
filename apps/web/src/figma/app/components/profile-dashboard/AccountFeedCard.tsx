"use client";

import React from "react";

export interface AccountFeedCardProps {
  activeTab: "actions" | "newFollowers";
  onTabChange: (tab: "actions" | "newFollowers") => void;
  actions: unknown[];
  newFollowers: unknown[];
  emptyMessage?: string;
}

export function AccountFeedCard({
  activeTab,
  onTabChange,
  actions,
  newFollowers,
  emptyMessage = "Coming soon (twitterapi.io feed)",
}: AccountFeedCardProps) {
  const items = activeTab === "actions" ? actions : newFollowers;
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
      <h3 className="text-sm font-semibold text-white/90">Account feed</h3>
      <div className="mt-3 flex gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => onTabChange("actions")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            activeTab === "actions" ? "bg-primary/20 text-primary" : "text-white/60 hover:bg-white/10"
          }`}
        >
          Account action
        </button>
        <button
          type="button"
          onClick={() => onTabChange("newFollowers")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            activeTab === "newFollowers" ? "bg-primary/20 text-primary" : "text-white/60 hover:bg-white/10"
          }`}
        >
          New followers
        </button>
      </div>
      <div className="mt-3 min-h-[120px]">
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-white/50">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {(items as Record<string, unknown>[]).map((item, i) => (
              <li key={i} className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
                {JSON.stringify(item)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
