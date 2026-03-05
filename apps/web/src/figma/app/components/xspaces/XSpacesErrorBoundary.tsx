"use client";

import React, { Component, type ReactNode } from "react";
import { Button } from "../ui/button";
import { sanitizeErrorMessage } from "./utils";

type Props = { children: ReactNode };
type State = { error: Error | null };

const isProd = typeof process !== "undefined" && process.env.NODE_ENV === "production";

/**
 * Local error boundary for the XSpaces shell so one view crash does not blank the entire app.
 * Token-based UI only; no raw payloads shown. Logs only sanitized info in production.
 */
export class XSpacesErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (typeof console === "undefined") return;
    const safeMsg = sanitizeErrorMessage(error?.message);
    console.error("[XSpacesErrorBoundary]", safeMsg);
    if (!isProd && info?.componentStack) {
      console.error("[XSpacesErrorBoundary] componentStack:", info.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      const message = sanitizeErrorMessage(this.state.error?.message);
      return (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground mb-2">Something went wrong in XSpaces</p>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">{message}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              onClick={() => this.setState({ error: null })}
              variant="secondary"
              size="sm"
              className="rounded-xl"
            >
              Try again
            </Button>
            <Button
              type="button"
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
              className="rounded-xl"
            >
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
