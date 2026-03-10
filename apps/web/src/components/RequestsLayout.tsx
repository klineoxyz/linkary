"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Send } from "lucide-react";
import { cn } from "@/figma/app/components/ui/utils";

const CONTAINER_CLASS = "mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8";

type Tab = "inbox" | "sent";

type RequestsLayoutProps = {
  children: React.ReactNode;
  /** Badge count for Inbox tab (e.g. new requests). Omit when unknown. */
  inboxBadgeCount?: number;
};

export function RequestsLayout({ children, inboxBadgeCount }: RequestsLayoutProps) {
  const pathname = usePathname();
  const active: Tab = pathname?.includes("/profile/requests") ? "sent" : "inbox";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className={CONTAINER_CLASS}>
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/app/profile"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            ← Profile
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Collaboration requests from others and requests you’ve sent. Accept, archive, or follow up.
          </p>
        </header>

        <div className="border-b border-border">
          <nav className="flex gap-0" aria-label="Requests tabs">
            <Link
              href="/profile/inbox"
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                active === "inbox"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Inbox className="h-4 w-4 shrink-0" />
              Inbox
              {inboxBadgeCount != null && inboxBadgeCount > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  {inboxBadgeCount > 99 ? "99+" : inboxBadgeCount}
                </span>
              )}
            </Link>
            <Link
              href="/app/profile/requests"
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                active === "sent"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Send className="h-4 w-4 shrink-0" />
              Sent
            </Link>
          </nav>
        </div>

        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

export { CONTAINER_CLASS };
