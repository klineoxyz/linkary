"use client";

import type { ReactNode } from "react";

/**
 * Avatar + handle/label for CRM tables. Client so it can be used inside client rows (e.g. submissions).
 */
export function ParticipantCell({
  avatarUrl,
  label,
  prefix,
  size = "md",
}: {
  avatarUrl?: string | null;
  label: string;
  prefix?: ReactNode;
  size?: "sm" | "md";
}) {
  const frame = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const initialsSize = size === "sm" ? "text-[9px]" : "text-[10px]";
  const src = avatarUrl?.trim() || null;
  const initials = (label.replace(/^@/, "").slice(0, 2) || "?").toUpperCase();

  return (
    <div className="flex items-center gap-2 min-w-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={`${frame} shrink-0 rounded-full object-cover border border-[var(--crm-border)]`}
        />
      ) : (
        <div
          className={`${frame} shrink-0 rounded-full bg-[var(--crm-border)] flex items-center justify-center font-medium ${initialsSize} text-[var(--crm-muted)]`}
          aria-hidden
        >
          {initials}
        </div>
      )}
      <span className="flex items-center gap-1 min-w-0 truncate text-[var(--crm-foreground)]">
        {prefix != null && prefix !== false ? <span className="shrink-0 text-[var(--crm-muted)]">{prefix}</span> : null}
        <span className="truncate">{label}</span>
      </span>
    </div>
  );
}
