/**
 * XSpaces shared utilities — safe for production, no token leakage.
 * Debug logging is disabled in production unless ?debug=1.
 */

const isDev =
  typeof process !== "undefined"
    ? process.env.NODE_ENV !== "production"
    : typeof window !== "undefined"
      ? (window as unknown as { __LINKARY_DEV__?: boolean }).__LINKARY_DEV__ === true
      : false;

export function xspacesDebug(...args: unknown[]): void {
  if (!isDev) return;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location?.search ?? "");
    if (params.get("debug") !== "1") return;
  }
  // eslint-disable-next-line no-console
  console.log("[XSpaces]", ...args);
}

/**
 * Return a user-safe error message. Never expose stack traces, tokens, or raw API payloads.
 */
export function sanitizeErrorMessage(raw: unknown): string {
  if (raw == null) return "Something went wrong.";
  if (typeof raw === "string") {
    const trimmed = raw.trim().slice(0, 200);
    if (/token|password|secret|bearer|authorization/i.test(trimmed)) return "Something went wrong.";
    return trimmed || "Something went wrong.";
  }
  if (typeof raw === "object" && "message" in raw && typeof (raw as { message: unknown }).message === "string")
    return sanitizeErrorMessage((raw as { message: string }).message);
  if (typeof raw === "object" && "error" in raw && typeof (raw as { error: unknown }).error === "string")
    return sanitizeErrorMessage((raw as { error: string }).error);
  return "Something went wrong.";
}

/** Local YMD string (YYYY-MM-DD) for a given Date in the browser's local timezone. */
export function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Label for a calendar day (YMD string). Uses local date for Today/Tomorrow.
 * Safe for Europe/Berlin and other timezones (browser local).
 * @param now - Optional reference date for "today" (for tests); defaults to new Date().
 */
export function getDateLabel(ymd: string, now: Date = new Date()): string {
  const [y, mo, day] = ymd.split("-").map(Number);
  if (y == null || mo == null || day == null || Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(day)) {
    return ymd;
  }
  const d = new Date(y, mo - 1, day);
  const todayYMD = toLocalYMD(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowYMD = toLocalYMD(tomorrow);
  if (ymd === todayYMD) return "Today";
  if (ymd === tomorrowYMD) return "Tomorrow";
  return d.toLocaleDateString("default", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Format scheduled_at (ISO string) as local time only. Uses browser locale.
 */
export function formatTime(scheduledAt: string | null): string {
  if (!scheduledAt) return "—";
  return new Date(scheduledAt).toLocaleTimeString("default", { hour: "numeric", minute: "2-digit" });
}

/** Display title for a space: linkary_title (override) > x_title (source) > title (legacy). Use consistently across XSpaces UI. */
export function displayTitle(space: {
  linkary_title?: string | null;
  x_title?: string | null;
  title?: string | null;
}): string {
  const lt = space.linkary_title?.trim();
  if (lt) return lt;
  const xt = space.x_title?.trim();
  if (xt) return xt;
  const t = space.title?.trim();
  return t ?? "";
}
