"use client";

import AppWithProviders from "../../AppWithProviders";
import { GigDealsPanel } from "@/components/profile-work/GigDealsPanel";

export default function MyDealsPage() {
  return (
    <AppWithProviders>
      <GigDealsPanel variant="standalone" />
    </AppWithProviders>
  );
}
