"use client";

import React from "react";

const MIN_EMPTY_HEIGHT = 152;

export interface EmptyStateProps {
  message: string;
  secondary?: string;
  coverage?: string;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  integrationsHref?: string;
}

export function EmptyState({
  message,
  secondary,
  coverage,
  onRefresh,
  refreshDisabled,
  integrationsHref,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col justify-center py-4 px-1"
      style={{ minHeight: MIN_EMPTY_HEIGHT }}
      data-page="analytics"
    >
      <p className="text-sm text-muted-foreground">
        {message}
        {coverage && <span className="text-muted-foreground/90"> · {coverage}</span>}
      </p>
      {secondary && <p className="text-xs text-muted-foreground/90 mt-1">{secondary}</p>}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshDisabled}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
          >
            Refresh
          </button>
        )}
        {integrationsHref && (
          <a
            href={integrationsHref}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Connect more in Integrations
          </a>
        )}
      </div>
    </div>
  );
}
