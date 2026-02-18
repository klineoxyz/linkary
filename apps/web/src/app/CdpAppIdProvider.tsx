"use client";

import React, { createContext, useContext } from "react";

const CdpAppIdContext = createContext<string>("");

export function CdpAppIdProvider({
  appId,
  children,
}: {
  appId: string;
  children: React.ReactNode;
}) {
  return (
    <CdpAppIdContext.Provider value={appId ?? ""}>
      {children}
    </CdpAppIdContext.Provider>
  );
}

export function useCdpAppId(): string {
  return useContext(CdpAppIdContext);
}
