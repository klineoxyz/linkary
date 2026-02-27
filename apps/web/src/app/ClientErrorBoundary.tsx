"use client";

import React, { Component, type ReactNode } from "react";
import Link from "next/link";

function getPathname(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname || "/";
}

function getAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

function safeStack(err: Error): string {
  try {
    return err.stack || "";
  } catch {
    return "";
  }
}

type Props = { children: ReactNode };
type State = { error: Error | null; debugId: string };

export class ClientErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, debugId: "" };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      error,
      debugId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  componentDidCatch(error: Error, _info: React.ErrorInfo): void {
    const pathname = getPathname();
    const userAgent = getAgent();
    const msg = error.message || "";
    const stack = safeStack(error);
    if (typeof console !== "undefined") {
      console.error("[CLIENT_ERROR_BOUNDARY]", {
        message: msg,
        pathname,
        userAgent: userAgent.slice(0, 200),
        stack: stack.slice(0, 500),
      });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 py-8 text-foreground">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            We’ve recorded the issue. If it keeps happening, try reloading or going back home.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Reload
            </button>
            <Link
              href="/"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              Go home
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground font-mono" aria-hidden="true">
            {this.state.debugId}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
