"use client";

import React from "react";

interface EmptyStateCardProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  className?: string;
  /** Optional CTA (e.g. "Connect X" -> Integrations) */
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyStateCard({ title, message, icon, className = "", actionLabel, onAction }: EmptyStateCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 text-center ${className}`}
    >
      {icon && <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-white/40">{icon}</div>}
      <h3 className="text-sm font-medium text-white/80">{title}</h3>
      <p className="mt-1 text-xs text-white/50">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-lg bg-primary/20 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/30"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
