"use client";

import type { ReactNode } from "react";
import LinkaryApp from "@/figma/app/App";
import { useCdpAppId } from "@/app/CdpAppIdProvider";
import CdpProviderGate from "@/app/CdpProviderGate";
/* Design-system tokens (theme.css) and Tailwind for figma app - required for bg-primary, text-primary, chart-*, etc. */
import "@/figma/styles/index.css";

type AppWithProvidersProps = {
  children?: ReactNode;
};

/**
 * Renders app content. CDP (Coinbase embedded wallet) is mounted only when user has a session,
 * so public pages never run wallet auth/refresh and cannot 401-crash. 401 in wallet area is caught by CdpErrorBoundary.
 */
export default function AppWithProviders({ children }: AppWithProvidersProps) {
  const cdpAppId = useCdpAppId();
  const content = children ?? <LinkaryApp />;
  if (!cdpAppId) return <>{content}</>;
  return <CdpProviderGate>{content}</CdpProviderGate>;
}
