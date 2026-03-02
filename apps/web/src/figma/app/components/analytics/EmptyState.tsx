"use client";

import React from "react";

export interface EmptyStateProps {
  title?: string;
  message: string;
  /** Optional coverage text e.g. "3/30 days" */
  coverage?: string;
  onRefresh?: () => void;
  refreshLabel?: string;
  refreshDisabled?: boolean;
}

export function EmptyState({
  title = "Building history",
  message,
  coverage,
  onRefresh,
  refreshLabel = "Refresh",
  refreshDisabled,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center min-h-[120px]">
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground mb-2">{message}</p>
      {coverage && <p className="text-xs text-muted-foreground mb-3">{coverage}</p>}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshDisabled}
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          {refreshLabel}
        </button>
      )}
    </div>
  );
}
