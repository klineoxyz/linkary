"use client";

import AppWithProviders from "../../AppWithProviders";
import { OrgRouteProvider } from "@/lib/orgRouteContext";
import type { Org } from "@/lib/orgs";

export default function OrgPageClient({
  initialOrgId,
  initialOrgSnapshot,
}: {
  initialOrgId: string;
  initialOrgSnapshot: Org | null;
}) {
  return (
    <OrgRouteProvider initialOrgId={initialOrgId} initialOrgSnapshot={initialOrgSnapshot}>
      <AppWithProviders />
    </OrgRouteProvider>
  );
}
