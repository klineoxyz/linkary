"use client";

import { CDPReactProvider } from "@coinbase/cdp-react";
import LinkaryApp from "@/figma/app/App";
import { useCdpAppId } from "@/app/CdpAppIdProvider";

export default function AppWithProviders() {
  const cdpProjectId = useCdpAppId();
  return cdpProjectId ? (
    <CDPReactProvider
      config={{
        projectId: cdpProjectId,
        ethereum: { createOnLogin: "eoa" },
        appName: "Linkary",
      }}
    >
      <LinkaryApp />
    </CDPReactProvider>
  ) : (
    <LinkaryApp />
  );
}
