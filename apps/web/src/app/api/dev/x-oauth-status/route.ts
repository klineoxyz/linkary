/**
 * GET /api/dev/x-oauth-status — DEV only. Returns which X OAuth env vars are set (names only, no values).
 * Available only when NODE_ENV !== 'production'. Bearer required.
 */
import { NextRequest, NextResponse } from "next/server";

const CONNECT_REQUIRED = ["X_CLIENT_ID", "X_OAUTH_COOKIE_SECRET"] as const;
const CALLBACK_REQUIRED = ["X_CLIENT_ID", "X_CLIENT_SECRET", "X_OAUTH_COOKIE_SECRET", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missingConnect = CONNECT_REQUIRED.filter((key) => !process.env[key]) as string[];
  const missingCallback = CALLBACK_REQUIRED.filter((key) => !process.env[key]) as string[];

  const origin = request.nextUrl.origin;
  const callbackUrlExpected = `${origin}/api/x/callback`;

  return NextResponse.json({
    configured_connect: missingConnect.length === 0,
    configured_callback: missingCallback.length === 0,
    missing_connect: missingConnect,
    missing_callback: missingCallback,
    callback_url_expected: callbackUrlExpected,
  });
}
