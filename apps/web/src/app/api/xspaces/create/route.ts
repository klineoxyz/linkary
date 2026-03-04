import { NextRequest, NextResponse } from "next/server";

/** POST /api/xspaces/create — create space (delegates to POST /api/spaces) */
export async function POST(request: NextRequest) {
  const base = request.nextUrl.origin;
  const authHeader = request.headers.get("authorization");
  const body = await request.text();
  const res = await fetch(`${base}/api/spaces`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
