"use client";

import React from "react";
import { Home, Compass, CalendarDays } from "lucide-react";

export type MainNav = "home" | "explore" | "calendar";

export function XSpacesSidebar({
  mainNav,
  onNav,
}: {
  mainNav: MainNav;
  onNav: (n: MainNav) => void;
}) {
  const items: { id: MainNav; label: string; icon: React.ElementType }[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "explore", label: "Explore", icon: Compass },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
  ];

  return (
    <aside
      className="w-full sm:w-56 shrink-0 border-r border-border bg-card rounded-2xl sm:rounded-r-none overflow-hidden"
      aria-label="XSpaces navigation"
      data-testid="xspaces-sidebar"
    >
      <nav className="p-2 sm:p-3 flex flex-row sm:flex-col gap-1">
        {items.map(({ id, label, icon: Icon }) => {
          const active = mainNav === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNav(id)}
              data-testid={id === "calendar" ? "xspaces-nav-calendar" : undefined}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground border border-transparent"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
