"use client";

export const PRODUCT_EVENT_NAMES = [
  "auth_signed_in",
  "profile_viewed",
  "profile_completed",
  "profile_published_or_saved",
  "x_connect_started",
  "x_connect_completed",
  "analytics_opened",
  "analytics_refresh_requested",
  "marketplace_opened",
  "campaign_list_opened",
  "campaign_created",
  "campaign_create_opened",
  "campaign_launched",
  "campaign_finalized",
  "report_opened",
  "case_study_opened",
  "ops_action_used",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export function trackProductEventClient(
  event_name: ProductEventName,
  properties?: Record<string, unknown>
): void {
  try {
    const body = JSON.stringify({
      event_name,
      properties: {
        ...(properties ?? {}),
        page_path: typeof window !== "undefined" ? window.location.pathname : undefined,
      },
    });

    void fetch("/api/telemetry/product", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // best-effort only
  }
}

