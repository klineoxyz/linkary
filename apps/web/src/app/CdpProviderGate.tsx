"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCdpAppId } from "@/app/CdpAppIdProvider";
import { CdpErrorBoundary, clearCdpPersistedState } from "@/app/CdpErrorBoundary";

/** CDP (Coinbase embedded wallet) is loaded only on wallet routes to keep it off the main app chunk. */
type CdpModule = { CDPReactProvider: React.ComponentType<{ config: unknown; children: ReactNode }> };

/** Routes where CDP (Coinbase embedded wallet) is allowed to mount. All other routes never load CDP. */
const WALLET_ROUTES = ["/settings/wallet", "/wallet"];

function isWalletRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.replace(/\/$/, "") || "/";
  return WALLET_ROUTES.some((route) => path === route || path.startsWith(route + "/"));
}

function isLikelyCdp401(reason: unknown): boolean {
  let s = "";
  if (reason instanceof Error) s = reason.message;
  else if (typeof reason === "string") s = reason;
  else if (reason && typeof reason === "object" && "message" in reason) s = String((reason as { message: unknown }).message);
  else s = String(reason ?? "");
  s = s.toLowerCase();
  const hasAuth = s.includes("401") || s.includes("unauthorized") || s.includes("auth/refresh") || (s.includes("refresh") && s.includes("token"));
  const hasCdp = s.includes("cdp") || s.includes("coinbase") || s.includes("embedded-wallet");
  return hasAuth && hasCdp;
}

/**
 * Registers unhandledrejection before any CDP code runs, so 401 from CDP refresh is caught
 * and does not crash the app. Runs once when this component mounts (on wallet routes we
 * mount first, then CDP mounts as child).
 */
function useCdpRejectionHandler(): void {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isLikelyCdp401(event.reason)) {
        clearCdpPersistedState();
        if (typeof console !== "undefined") console.warn("[CDP] Wallet refresh failed (401); cleared persisted state.");
        event.preventDefault?.();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);
}

/**
 * Mounts CDP (Coinbase embedded wallet) only on wallet-required routes.
 * All other routes (/, /{username}, /explore, /profile/*, etc.) never load CDP,
 * so auth/refresh is never called and 401 cannot crash those pages.
 */
export default function CdpProviderGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const cdpAppId = useCdpAppId();
  useCdpRejectionHandler();
  const [cdpModule, setCdpModule] = useState<CdpModule | null>(null);

  const shouldMountCdp = !!cdpAppId && isWalletRoute(pathname);

  useEffect(() => {
    if (!shouldMountCdp) return;
    let cancelled = false;
    import("@coinbase/cdp-react").then((m) => {
      if (!cancelled) setCdpModule({ CDPReactProvider: m.CDPReactProvider });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [shouldMountCdp]);

  if (!shouldMountCdp) {
    return <>{children}</>;
  }

  if (!cdpModule) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading wallet…
      </div>
    );
  }

  const { CDPReactProvider } = cdpModule;
  return (
    <CDPReactProvider
      config={{
        projectId: cdpAppId,
        ethereum: { createOnLogin: "eoa" },
        appName: "Linkary",
        authMethods: ["oauth:x"],
      }}
    >
      <CdpErrorBoundary>{children}</CdpErrorBoundary>
    </CDPReactProvider>
  );
}
