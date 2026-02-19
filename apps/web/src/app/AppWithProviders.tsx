"use client";

import { CDPReactProvider } from "@coinbase/cdp-react";
import LinkaryApp from "@/figma/app/App";
import { useCdpAppId } from "@/app/CdpAppIdProvider";
/* Design-system tokens (theme.css) and Tailwind for figma app - required for bg-primary, text-primary, chart-*, etc. */
import "@/figma/styles/index.css";

export default function AppWithProviders() {
  const cdpProjectId = useCdpAppId();
  return cdpProjectId ? (
    <CDPReactProvider
      config={{
        projectId: cdpProjectId,
        ethereum: { createOnLogin: "eoa" },
        appName: "Linkary",
        authMethods: ["oauth:x"],
      }}
    >
      <LinkaryApp />
    </CDPReactProvider>
  ) : (
    <LinkaryApp />
  );
}
