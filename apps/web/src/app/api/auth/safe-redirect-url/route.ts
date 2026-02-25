/**
 * GET /api/auth/safe-redirect-url?next=/path or ?for=callback
 * Returns a redirect URL whose host is in AUTH_REDIRECT_ALLOWLIST.
 * Use for OAuth redirect_uri and for post-login redirect to avoid wrong-host redirects.
 */
import { NextRequest, NextResponse } from "next/server";

const FALLBACK_ORIGIN = "https://www.linkary.xyz";

function getAllowedOrigin(): string {
  const allowlistRaw = process.env.AUTH_REDIRECT_ALLOWLIST ?? "";
  const hostnames = allowlistRaw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  let siteOrigin = "";
  let siteHost = "";
  try {
    if (siteUrl && (siteUrl.startsWith("http://") || siteUrl.startsWith("https://"))) {
      siteOrigin = new URL(siteUrl).origin;
      siteHost = new URL(siteUrl).hostname.toLowerCase();
    }
  } catch {
    /* ignore */
  }
  if (siteHost && (hostnames.length === 0 || hostnames.includes(siteHost))) {
    return siteOrigin || FALLBACK_ORIGIN;
  }
  if (hostnames.length > 0) {
    const first = hostnames[0];
    const protocol = first === "localhost" || first.startsWith("localhost:") ? "http" : "https";
    return `${protocol}://${first}`;
  }
  if (siteOrigin) return siteOrigin;
  return FALLBACK_ORIGIN;
}

/** Allow only relative path: starts with /, no protocol, no //, no backslashes. */
function sanitizeNext(next: string): string {
  const s = (next ?? "").trim();
  if (s === "" || !s.startsWith("/")) return "/";
  const lower = s.toLowerCase();
  if (lower.includes("//") || lower.includes("\\") || lower.includes("http") || lower.includes("javascript:") || lower.includes("%00")) {
    return "/";
  }
  return s;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nextRaw = searchParams.get("next") ?? "";
  const forCallback = searchParams.get("for") === "callback";
  const origin = getAllowedOrigin();
  const path = forCallback ? "/auth/callback" : sanitizeNext(nextRaw);
  if (forCallback === false && nextRaw !== "" && path === "/" && nextRaw.trim() !== "") {
    console.warn("[safe-redirect-url] invalid next param rejected:", nextRaw);
  }
  const redirectUrl = `${origin.replace(/\/$/, "")}${path}`;
  return NextResponse.json({ redirectUrl });
}
