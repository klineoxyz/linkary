"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar, List, Clock } from "lucide-react";
import { Button } from "../ui/button";
import { getDateLabel, formatTime } from "./utils";

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
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const grid = getCalendarGrid(year, month);
  const flattenedSpaces = useMemo(() => {
    const out: { space: SpaceForCalendar; ymd: string }[] = [];
    spacesByDay.forEach((arr, ymd) => arr.forEach((s) => out.push({ space: s, ymd })));
    out.sort((a, b) => (a.space.scheduled_at ?? "").localeCompare(b.space.scheduled_at ?? ""));
    return out;
  }, [spacesByDay]);

  const groupedByDateLabel = useMemo(() => {
    const map = new Map<string, { space: SpaceForCalendar; ymd: string }[]>();
    flattenedSpaces.forEach((item) => {
      const label = getDateLabel(item.ymd);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    });
    return map;
  }, [flattenedSpaces]);

  const orderedDateLabels = useMemo(() => {
    const order = ["Today", "Tomorrow"];
    const rest = Array.from(groupedByDateLabel.keys()).filter((k) => !order.includes(k));
    rest.sort((a, b) => {
      const aItem = groupedByDateLabel.get(a)?.[0];
      const bItem = groupedByDateLabel.get(b)?.[0];
      return (aItem?.ymd ?? "").localeCompare(bItem?.ymd ?? "");
    });
    return [...order.filter((k) => groupedByDateLabel.has(k)), ...rest];
  }, [groupedByDateLabel]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-2">
        <Button variant="ghost" size="icon" onClick={onPrevMonth} className="rounded-xl shrink-0" aria-label="Previous month">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">
            {new Date(year, month - 1).toLocaleDateString("default", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <div className="flex rounded-full p-0.5 bg-muted">
            <Button
              type="button"
              variant={viewMode === "month" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-full text-xs h-7 px-3"
              onClick={() => setViewMode("month")}
            >
              <Calendar className="w-3.5 h-3.5 mr-1" />
              Month
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-full text-xs h-7 px-3"
              onClick={() => setViewMode("list")}
            >
              <List className="w-3.5 h-3.5 mr-1" />
              List
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs h-7 px-3 text-muted-foreground" disabled title="Coming soon">
              Week
            </Button>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onNextMonth} className="rounded-xl shrink-0" aria-label="Next month">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
      {viewMode === "list" ? (
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {flattenedSpaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events this month.</p>
          ) : (
            orderedDateLabels.map((label) => {
              const groupItems = groupedByDateLabel.get(label) ?? [];
              return (
                <div key={label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
                  <div className="space-y-2">
                    {groupItems.map(({ space, ymd }) => (
                      <div
                        key={space.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onEventClick?.(space)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onEventClick?.(space);
                          }
                        }}
                        className="p-4 rounded-2xl border border-border bg-card hover:border-primary/20 hover:bg-accent/50 transition-colors cursor-pointer text-left flex items-start gap-3"
                        aria-label={`${space.title}, ${formatTime(space.scheduled_at)}`}
                      >
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                          <Clock className="w-4 h-4" />
                          {formatTime(space.scheduled_at)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{space.title}</p>
                          <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            Planned
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <>
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
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(s);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onEventClick?.(s);
                      }
                    }}
                    className="text-xs truncate rounded-lg px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 mb-0.5 cursor-pointer hover:bg-primary/20"
                    aria-label={s.title}
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
        </>
      )}
    </div>
  );
}
