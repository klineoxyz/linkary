"use client";

import React, { createContext, useContext } from "react";

/**
 * When the org page was server-rendered, we resolved the org by segment.
 * This context passes the resolved org id so the client can load the org by id
 * without relying on slug lookup (which can fail for unpublished orgs or encoding).
 */
export const OrgRouteContext = createContext<{ initialOrgId: string | null }>({ initialOrgId: null });

export function useOrgRouteInitialId(): string | null {
  return useContext(OrgRouteContext).initialOrgId;
}

export function OrgRouteProvider({
  initialOrgId,
  children,
}: {
  initialOrgId: string | null;
  children: React.ReactNode;
}) {
  return (
    <OrgRouteContext.Provider value={{ initialOrgId }}>
      {children}
    </OrgRouteContext.Provider>
  );
}
