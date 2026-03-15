/**
 * GET /api/health — minimal response, no dependencies.
 * Use to verify the dev server is responding (e.g. http://localhost:3000/api/health).
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, message: "Dev server is running" });
}
