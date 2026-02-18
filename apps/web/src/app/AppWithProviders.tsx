"use client";

import { CDPReactProvider } from "@coinbase/cdp-react";
import LinkaryApp from "@/figma/app/App";

const cdpProjectId = process.env.NEXT_PUBLIC_CDP_APP_ID ?? "";

export default function AppWithProviders() {
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
