import { NextRequest, NextResponse } from "next/server";
import { getPublicDTOByUsername } from "@/lib/getPublicDTO";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createServiceSupabase } from "@/lib/x-analytics-server";

const CACHE_PUBLISHED = "s-maxage=60, stale-while-revalidate=300";
const CACHE_SHORT = "s-maxage=30, stale-while-revalidate=60";

export const dynamic = "force-dynamic";

function logDev(message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[public/profile] ${message}`, meta ?? "");
  }
}

/**
 * GET /api/public/profile/[username]
 * Returns strict PublicPageDTO for the public 1-pager. No email, user_id, or private fields.
 * - 200 + DTO when published profile/org found
 * - 404 for not found AND for unpublished (no enumeration: unauthenticated callers cannot tell which)
 * Public endpoints must not vary on Authorization.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username: raw } = await context.params;
  const segment = (raw ?? "").trim();
  if (!segment) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  let serviceSupabase: ReturnType<typeof createServiceSupabase> | null = null;
  try {
    serviceSupabase = createServiceSupabase();
  } catch {
    /* no service key; unpublished check skipped */
  }

  const ip = getClientIp(_request);
  const norm = segment.toLowerCase().replace(/^@/, "");
  if (serviceSupabase) {
    const rl = await rateLimit({
      key: `public_profile:${norm}:ip:${ip}`,
      limit: 120,
      windowSeconds: 60,
      supabaseAdmin: serviceSupabase,
    });
    if (!rl.allowed) {
      logDev("rate_limited", { username: norm, ip });
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  const result = await getPublicDTOByUsername(segment, {
    serviceSupabase: serviceSupabase ?? undefined,
  });

  if (result.ok) {
    return NextResponse.json(result.dto, {
      headers: {
        "Cache-Control": CACHE_PUBLISHED,
        Vary: "Accept-Encoding",
      },
    });
  }

  if ("unpublished" in result && result.unpublished) {
    logDev("unpublished_404", { username: norm });
  } else {
    logDev("not_found", { username: norm });
  }

  return NextResponse.json({ error: "Not found" }, {
    status: 404,
    headers: {
      "Cache-Control": CACHE_SHORT,
      Vary: "Accept-Encoding",
    },
  });
}
