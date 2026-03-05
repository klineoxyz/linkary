"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_EVENTS_PER_DAY = 3;

function getMonthStart(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}
function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}
function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function getCalendarGrid(
  year: number,
  month: number
): { date: Date; isCurrentMonth: boolean }[][] {
  const start = getMonthStart(year, month);
  const startDay = start.getDay();
  const monFirst = startDay === 0 ? 6 : startDay - 1;
  const startPad = new Date(start);
  startPad.setDate(startPad.getDate() - monFirst);
  const weeks: { date: Date; isCurrentMonth: boolean }[][] = [];
  let row: { date: Date; isCurrentMonth: boolean }[] = [];
  const cur = new Date(startPad);
  const end = getMonthEnd(year, month);
  const endTime = end.getTime();
  while (cur.getTime() <= endTime || row.length > 0) {
    row.push({
      date: new Date(cur),
      isCurrentMonth: cur.getMonth() === month - 1,
    });
    if (row.length === 7) {
      weeks.push(row);
      row = [];
    }
    cur.setDate(cur.getDate() + 1);
  }
  if (row.length) {
    while (row.length < 7) {
      row.push({ date: new Date(cur), isCurrentMonth: false });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

export type SpaceForCalendar = {
  id: string;
  title: string;
  scheduled_at: string | null;
};

export function CalendarView({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  spacesByDay,
  onDateClick,
  onEventClick,
}: {
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  spacesByDay: Map<string, SpaceForCalendar[]>;
  onDateClick?: (ymd: string) => void;
  onEventClick?: (space: SpaceForCalendar) => void;
}) {
  const grid = getCalendarGrid(year, month);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button
          type="button"
          onClick={onPrevMonth}
          className="p-2 rounded-xl hover:bg-accent text-foreground transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {new Date(year, month - 1).toLocaleDateString("default", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            type="button"
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-accent"
          >
            Month
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Week
          </button>
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          className="p-2 rounded-xl hover:bg-accent text-foreground transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b border-border">
        {WEEKDAY_LABELS.map((l) => (
          <div key={l} className="py-2">
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((week, wi) =>
          week.map((cell, di) => {
            const ymd = toYMD(cell.date);
            const daySpaces = spacesByDay.get(ymd) ?? [];
            const visible = daySpaces.slice(0, MAX_EVENTS_PER_DAY);
            const more = daySpaces.length - MAX_EVENTS_PER_DAY;
            return (
              <div
                key={`${wi}-${di}`}
                onClick={() => onDateClick?.(ymd)}
                className={`min-h-[100px] p-1.5 border-b border-r border-border last:border-r-0 ${
                  cell.isCurrentMonth ? "bg-card" : "bg-muted/30"
                } ${onDateClick ? "cursor-pointer hover:bg-accent" : ""}`}
              >
                <div
                  className={`text-sm font-medium mb-1 ${
                    cell.isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {cell.date.getDate()}
                </div>
                {visible.map((s) => (
                  <div
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(s);
                    }}
                    className="text-xs truncate rounded-lg px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 mb-0.5 cursor-pointer hover:bg-primary/20"
                  >
                    {s.title}
                  </div>
                ))}
                {more > 0 && (
                  <div className="text-xs text-muted-foreground px-1">+{more} more</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
