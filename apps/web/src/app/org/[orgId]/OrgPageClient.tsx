"use client";

import AppWithProviders from "../../AppWithProviders";
import { OrgRouteProvider } from "@/lib/orgRouteContext";

export default function OrgPageClient({ initialOrgId }: { initialOrgId: string }) {
  return (
    <OrgRouteProvider initialOrgId={initialOrgId}>
      <AppWithProviders />
    </OrgRouteProvider>
  );
}
