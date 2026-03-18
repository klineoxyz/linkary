/**
 * Active operating context: personal profile vs org (validated via org_members).
 * Cookie is set only by POST /api/me/active-context after server validation.
 */
export const ACTIVE_CONTEXT_COOKIE = "linkary_active_context";
export const ACTIVE_CONTEXT_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year

/** Cookie value: literal "personal" or "org:" + UUID */
export function encodeActiveContextCookie(mode: "personal", orgId?: null): string;
export function encodeActiveContextCookie(mode: "org", orgId: string): string;
export function encodeActiveContextCookie(mode: "personal" | "org", orgId?: string | null): string {
  if (mode === "personal") return "personal";
  if (!orgId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orgId)) {
    return "personal";
  }
  return `org:${orgId.toLowerCase()}`;
}

export function parseActiveContextCookie(raw: string | undefined | null): { mode: "personal" | "org"; orgId: string | null } {
  const v = (raw ?? "").trim();
  if (!v || v === "personal") return { mode: "personal", orgId: null };
  if (v.startsWith("org:")) {
    const id = v.slice(4).trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return { mode: "org", orgId: id.toLowerCase() };
    }
  }
  return { mode: "personal", orgId: null };
}

export type ActiveContextOrg = {
  id: string;
  name: string;
  slug: string;
  role: string;
};
