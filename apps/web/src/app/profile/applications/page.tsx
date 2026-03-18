"use client";

import AppWithProviders from "../../AppWithProviders";
import { MyApplicationsPanel } from "@/components/profile-work/MyApplicationsPanel";

export default function MyApplicationsPage() {
  return (
    <AppWithProviders>
      <MyApplicationsPanel variant="standalone" />
    </AppWithProviders>
  );
}
