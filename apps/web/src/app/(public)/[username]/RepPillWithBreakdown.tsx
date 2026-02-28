"use client";

import React, { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { RepBreakdownModal } from "@/components/rep/RepBreakdownModal";

export function RepPillWithBreakdown({
  repScore,
  username,
  variant = "header",
}: {
  repScore: number;
  username: string;
  variant?: "header" | "pill" | "proof";
}) {
  const [open, setOpen] = useState(false);

  const title = "REP is based on social signals, verified work, and network trust. Click for breakdown.";

  if (variant === "header") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-bold tabular-nums text-primary shadow-sm shadow-primary/15 hover:bg-primary/20"
          title={title}
        >
          REP {repScore}
        </button>
        <RepBreakdownModal open={open} onOpenChange={setOpen} username={username} />
      </>
    );
  }
  if (variant === "proof") {
    return (
      <>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">REP</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground hover:underline"
            title={title}
          >
            {repScore}
          </button>
        </div>
        <RepBreakdownModal open={open} onOpenChange={setOpen} username={username} />
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-muted/80"
        title={title}
      >
        <BadgeCheck className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden /> REP {repScore}
      </button>
      <RepBreakdownModal open={open} onOpenChange={setOpen} username={username} />
    </>
  );
}
