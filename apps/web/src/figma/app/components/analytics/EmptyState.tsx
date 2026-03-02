"use client";

import React from "react";

export interface EmptyStateProps {
  /** Single short message (no large blocks) */
  message: string;
  /** Optional coverage e.g. "3/30 days" — shown inline or small */
  coverage?: string;
  /** Optional subtle secondary refresh (header button is main CTA) */
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

export function EmptyState({
  message,
  coverage,
  onRefresh,
  refreshDisabled,
}: EmptyStateProps) {
  return (
    <div className="py-4 px-1">
      <p className="text-sm text-muted-foreground">
        {message}
        {coverage && <span className="text-muted-foreground/90"> · {coverage}</span>}
      </p>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshDisabled}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
