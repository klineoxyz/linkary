"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CDPReactProvider } from "@coinbase/cdp-react";
import { useCdpAppId } from "@/app/CdpAppIdProvider";
import { CdpErrorBoundary, clearCdpPersistedState } from "@/app/CdpErrorBoundary";
import { supabase } from "@/lib/supabase";

function isLikelyCdp401(reason: unknown): boolean {
  const msg = reason instanceof Error ? reason.message : String(reason ?? "");
  const s = msg.toLowerCase();
  return (s.includes("401") || s.includes("unauthorized")) && (s.includes("cdp") || s.includes("coinbase") || s.includes("auth/refresh") || s.includes("embedded-wallet"));
}

/**
 * Renders children. When CDP app id is set AND user has a Supabase session,
 * wraps children in CDPReactProvider so wallet features work.
 * When no session (e.g. public visitor), children render without CDP so
 * auth/refresh is never called and 401 cannot crash the page.
 */
export default function CdpProviderGate({ children }: { children: ReactNode }) {
  const cdpAppId = useCdpAppId();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    function update(session: unknown) {
      if (mounted) setHasSession(!!session);
    }
    supabase.auth.getSession().then(({ data: { session } }) => update(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => update(session));
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isLikelyCdp401(event.reason)) {
        clearCdpPersistedState();
        if (typeof console !== "undefined") console.warn("[CDP] Wallet refresh failed (401); cleared persisted state.");
        event.preventDefault?.();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const shouldMountCdp = !!cdpAppId && hasSession === true;
  const content = children;

  if (!shouldMountCdp) {
    return <>{content}</>;
  }

  return (
    <CDPReactProvider
      config={{
        projectId: cdpAppId,
        ethereum: { createOnLogin: "eoa" },
        appName: "Linkary",
        authMethods: ["oauth:x"],
      }}
    >
      <CdpErrorBoundary>{content}</CdpErrorBoundary>
    </CDPReactProvider>
  );
}
