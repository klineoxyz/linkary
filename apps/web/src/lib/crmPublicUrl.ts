/**
 * Public CRM base URL for links from linkary.xyz (deliverables, tasks).
 * Set NEXT_PUBLIC_CRM_APP_URL in env (e.g. https://crm.linkary.xyz). No trailing slash.
 */
export function getCrmAppUrl(): string {
  const raw = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_CRM_APP_URL?.trim()) || "";
  if (raw) return raw.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:3001";
  }
  return "https://crm.linkary.xyz";
}
