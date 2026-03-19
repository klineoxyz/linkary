"use client";

import React, { createContext, useContext } from "react";
import type { Org } from "@/lib/orgs";

/**
 * When the org page was server-rendered, we resolved the org by segment.
 * Passes canonical id + optional full row so the client never shows "Org not found"
 * when slug/username differs from orgs.slug (usernames-only handles) or client fetch hiccups.
 */
export const OrgRouteContext = createContext<{
  initialOrgId: string | null;
  initialOrgSnapshot: Org | null;
}>({ initialOrgId: null, initialOrgSnapshot: null });

export function useOrgRouteInitialId(): string | null {
  return useContext(OrgRouteContext).initialOrgId;
}

export function useOrgRouteInitialSnapshot(): Org | null {
  return useContext(OrgRouteContext).initialOrgSnapshot;
}

export function OrgRouteProvider({
  initialOrgId,
  initialOrgSnapshot,
  children,
}: {
  initialOrgId: string | null;
  initialOrgSnapshot?: Org | null;
  children: React.ReactNode;
}) {
  return (
    <OrgRouteContext.Provider value={{ initialOrgId, initialOrgSnapshot: initialOrgSnapshot ?? null }}>
      {children}
    </OrgRouteContext.Provider>
  );
}
