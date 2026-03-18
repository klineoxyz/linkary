/**
 * Single source of copy + logic for owner-facing X analytics state.
 * Aligns Analytics page, embedded tab, and Integrations journey. No fake data.
 * Cross-user analytics must NOT import owner-only refresh/sync copy.
 */

export type OwnerAnalyticsState =
  | "no_x_handle"
  | "never_synced"
  | "queued_or_building"
  | "refresh_failed"
  | "partial_data"
  | "ready_stale"
  | "ready_recent"
  | "";

export const PATH_INTEGRATIONS = "/app/settings/integrations";
export const PATH_ANALYTICS = "/app/analytics";

export type OwnerFreshnessInput = {
  has_x_handle: boolean;
  last_sync_at: string | null;
  data_state: "none" | "partial" | "full";
};

/** Status banner under header (owner only). */
export function getOwnerStateBanner(
  ownerState: OwnerAnalyticsState,
  hasXHandle: boolean
): { tone: "info" | "warn" | "muted"; text: string } | null {
  switch (ownerState) {
    case "no_x_handle":
      return {
        tone: "muted",
        text: "Link your X account in Integrations to unlock analytics — we store snapshots so nothing loads live each visit.",
      };
    case "queued_or_building":
      return {
        tone: "info",
        text: "Your analytics are updating in the background — usually a few minutes. You can leave this page.",
      };
    case "refresh_failed":
      return {
        tone: "warn",
        text: "Last analytics refresh didn’t complete. Request a new refresh from Analytics.",
      };
    case "partial_data":
      return {
        tone: "info",
        text: "Your history is still building. Metrics will fill in when sync completes.",
      };
    case "never_synced":
      return hasXHandle
        ? {
            tone: "muted",
            text: "We haven’t loaded your X stats yet. Confirm sync in Integrations, then tap Request analytics refresh here.",
          }
        : null;
    case "ready_stale":
      return {
        tone: "muted",
        text: "Profile sync is over a week old. Request a refresh on Analytics for newer numbers.",
      };
    default:
      return null;
  }
}

/** Subline next to X title / freshness (owner only; uses real last_sync_at). */
export function getOwnerFreshnessLine(
  f: OwnerFreshnessInput,
  ownerState: OwnerAnalyticsState,
  opts?: { posts_total_in_window?: number }
): string {
  const posts = opts?.posts_total_in_window ?? 0;
  if (!f.has_x_handle) return "Connect X in Integrations to see analytics.";
  if (!f.last_sync_at && f.data_state === "none") return "Sync from Integrations, then refresh analytics.";
  if (f.last_sync_at) {
    const d = new Date(f.last_sync_at);
    if (!isNaN(d.getTime())) {
      const sec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (sec < 60) return "Last profile sync: just now";
      if (sec < 3600) return "Last profile sync: " + Math.floor(sec / 60) + "m ago";
      if (sec < 86400) return "Last profile sync: " + Math.floor(sec / 3600) + "h ago";
      if (sec < 604800) return "Last profile sync: " + Math.floor(sec / 86400) + "d ago";
      return "Last profile sync: " + d.toLocaleDateString();
    }
  }
  if (f.data_state === "partial") return "Building history…";
  if (f.data_state === "none" && f.has_x_handle && (ownerState === "ready_recent" || ownerState === "ready_stale")) {
    if (posts === 0) return "No posts in this window—zeros are expected, not missing data.";
  }
  if (f.data_state === "none" && f.has_x_handle)
    return "No activity in this window. Try 90d or request a refresh.";
  return "";
}

/** Empty KPI strip when no followers/posts in window (owner). */
export function getOwnerEmptyKpiMessage(
  hasXHandle: boolean,
  dataState: "none" | "partial" | "full",
  lastSyncAt: string | null
): { body: string; showIntegrationsCta: boolean } {
  if (!hasXHandle) {
    return {
      body: "Link X in Integrations first — then charts and KPIs appear here from stored data.",
      showIntegrationsCta: true,
    };
  }
  if (dataState === "none" && !lastSyncAt) {
    return {
      body: "Not loaded yet — normal for a new connection. After Integrations shows X linked, request a refresh below.",
      showIntegrationsCta: true,
    };
  }
  if (dataState === "none") {
    return {
      body: "No activity in this time window. Try 90d—or request a refresh if data should be newer.",
      showIntegrationsCta: false,
    };
  }
  return {
    body: "Metrics appear after X is connected and analytics have synced.",
    showIntegrationsCta: true,
  };
}

export const OWNER_REFRESH_BUTTON_IDLE = "Request analytics refresh";
export const OWNER_REFRESH_BUTTON_QUEUED = "Update in progress…";
export const OWNER_REFRESH_SUBCOPY =
  "Queues a background update (not instant). A few requests per hour.";
export function ownerRefreshFeedback(existing: boolean, rateLimited: boolean, error?: string): string {
  if (rateLimited) return "Too many refresh requests. Try again shortly.";
  if (existing) return "An update is already queued. Numbers may take a few minutes.";
  if (error) return error;
  return "Refresh requested. Updates usually appear within a few minutes—not instantly.";
}

/** Tailwind classes for owner status banners (shared surfaces). */
export function ownerBannerClassNames(tone: "info" | "warn" | "muted"): string {
  switch (tone) {
    case "warn":
      return "rounded-xl border border-destructive/30 bg-destructive/10 text-destructive dark:text-destructive";
    case "info":
      return "rounded-xl border border-amber-500/35 bg-amber-500/[0.07] text-amber-950 dark:text-amber-100/90";
    default:
      return "rounded-xl border border-border bg-muted/40 text-muted-foreground";
  }
}

/** Cross-user / privacy-safe empty state only. */
export const CROSS_USER_ANALYTICS_EMPTY_TITLE = "No public analytics snapshot";
export const CROSS_USER_ANALYTICS_EMPTY_BODY =
  "This profile doesn’t have a shared analytics snapshot yet. That’s normal—not an error.";
