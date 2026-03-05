"use client";

import React, { useState, useEffect } from "react";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function CountdownTimers({ scheduledAt }: { scheduledAt: string | null }) {
  const [diff, setDiff] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!scheduledAt) {
      setDiff(null);
      return;
    }
    const target = new Date(scheduledAt).getTime();
    const tick = () => {
      const now = Date.now();
      if (now >= target) {
        setDiff({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const d = Math.floor((target - now) / (24 * 60 * 60 * 1000));
      const h = Math.floor(((target - now) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const m = Math.floor(((target - now) % (60 * 60 * 1000)) / (60 * 1000));
      const s = Math.floor(((target - now) % (60 * 1000)) / 1000);
      setDiff({ days: d, hours: h, minutes: m, seconds: s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  if (!scheduledAt || diff === null) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {["Days", "Hours", "Minutes", "Seconds"].map((label) => (
          <div key={label} className="rounded-xl border border-border bg-muted/50 p-3 text-center">
            <div className="text-lg font-bold text-foreground">—</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="rounded-xl border border-border bg-muted/50 p-3 text-center">
        <div className="text-lg font-bold text-foreground">{pad(diff.days)}</div>
        <div className="text-xs text-muted-foreground">Days</div>
      </div>
      <div className="rounded-xl border border-border bg-muted/50 p-3 text-center">
        <div className="text-lg font-bold text-foreground">{pad(diff.hours)}</div>
        <div className="text-xs text-muted-foreground">Hours</div>
      </div>
      <div className="rounded-xl border border-border bg-muted/50 p-3 text-center">
        <div className="text-lg font-bold text-foreground">{pad(diff.minutes)}</div>
        <div className="text-xs text-muted-foreground">Minutes</div>
      </div>
      <div className="rounded-xl border border-border bg-muted/50 p-3 text-center">
        <div className="text-lg font-bold text-foreground">{pad(diff.seconds)}</div>
        <div className="text-xs text-muted-foreground">Seconds</div>
      </div>
    </div>
  );
}
