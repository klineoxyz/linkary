"use client";

import type { ReactNode } from "react";
import { CDPReactProvider } from "@coinbase/cdp-react";
import LinkaryApp from "@/figma/app/App";
import { useCdpAppId } from "@/app/CdpAppIdProvider";
/* Design-system tokens (theme.css) and Tailwind for figma app - required for bg-primary, text-primary, chart-*, etc. */
import "@/figma/styles/index.css";

type AppWithProvidersProps = {
  children?: ReactNode;
};

export default function AppWithProviders({ children }: AppWithProvidersProps) {
  const cdpProjectId = useCdpAppId();
  const content = children ?? <LinkaryApp />;
  return cdpProjectId ? (
    <CDPReactProvider
      config={{
        projectId: cdpProjectId,
        ethereum: { createOnLogin: "eoa" },
        appName: "Linkary",
        authMethods: ["oauth:x"],
      }}
    >
      {content}
    </CDPReactProvider>
  ) : (
    content
  );
}
