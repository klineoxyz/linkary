"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Reports Core Web Vitals (LCP, FID, CLS, FCP, TTFB, INP) for performance monitoring.
 * Mount once in root layout. Metrics are sent to the callback; you can forward to analytics.
 */
function reportMetric(metric: { name: string; value: number; id: string; rating?: string; delta?: number }) {
  const win = typeof window !== "undefined" ? (window as unknown as { __linkary_vitals?: (m: unknown) => void }) : null;
  if (!win?.__linkary_vitals) return;
  try {
    win.__linkary_vitals(metric);
  } catch {
    /* noop */
  }
  if (process.env.NODE_ENV === "development") {
    const label = metric.rating ? ` (${metric.rating})` : "";
    console.log(`[Web Vitals] ${metric.name}: ${metric.value}${label}`, metric.id);
  }
}

export function WebVitalsReporter() {
  useReportWebVitals(reportMetric);
  return null;
}
