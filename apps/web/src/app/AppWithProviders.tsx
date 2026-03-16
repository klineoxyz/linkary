"use client";

import type { ReactNode } from "react";
import LinkaryApp from "@/figma/app/App";
import { useCdpAppId } from "@/app/CdpAppIdProvider";
import CdpProviderGate from "@/app/CdpProviderGate";
/* Design-system tokens (theme.css) and Tailwind for figma app - required for bg-primary, text-primary, chart-*, etc. */
import "@/figma/styles/index.css";

type AppWithProvidersProps = {
  children?: ReactNode;
  /** When set, app opens on this route (e.g. "profileInsights" for /app/profile/insights). Ensures correct view when pathname sync is delayed. */
  initialRoute?: string;
};

/**
 * Renders app content. CDP (Coinbase embedded wallet) is mounted only on wallet routes
 * (/settings/wallet, /wallet/*) via CdpProviderGate pathname check—never on /, /{username}, etc.
 */
export default function AppWithProviders({ children, initialRoute }: AppWithProvidersProps) {
  const cdpAppId = useCdpAppId();
  const content = children ?? <LinkaryApp initialRoute={initialRoute} />;
  if (!cdpAppId) return <>{content}</>;
  return <CdpProviderGate>{content}</CdpProviderGate>;
}
