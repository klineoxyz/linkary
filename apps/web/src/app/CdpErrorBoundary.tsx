"use client";

import React, { Component, type ReactNode } from "react";
import Link from "next/link";

/** Clear CDP/wallet-related persisted state that might cause 401 on next load. */
export function clearCdpPersistedState(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.toLowerCase().includes("cdp") || key.toLowerCase().includes("coinbase") || key.toLowerCase().includes("embedded"))) {
        keys.push(key);
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

function isLikelyCdpAuthError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const s = msg.toLowerCase();
  return s.includes("401") || s.includes("unauthorized") || s.includes("auth/refresh") || s.includes("refresh") && s.includes("token");
}

type Props = { children: ReactNode };
type State = { error: Error | null; isCdpAuth: boolean };

export class CdpErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, isCdpAuth: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isCdpAuth = isLikelyCdpAuthError(error);
    return { error, isCdpAuth };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (isLikelyCdpAuthError(error)) {
      clearCdpPersistedState();
      if (typeof console !== "undefined" && process.env.NODE_ENV === "development") {
        console.warn("[CDP] Wallet session expired or invalid (401); cleared persisted state.", error?.message);
      }
    }
  }

  render(): ReactNode {
    if (this.state.error && this.state.isCdpAuth) {
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <p className="text-sm font-medium text-foreground">Wallet session expired</p>
          <p className="text-xs text-muted-foreground">Reconnect your wallet in Settings to continue.</p>
          <Link
            href="/settings/wallet"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Reconnect wallet
          </Link>
        </div>
      );
    }
    if (this.state.error) {
      throw this.state.error;
    }
    return this.props.children;
  }
}
