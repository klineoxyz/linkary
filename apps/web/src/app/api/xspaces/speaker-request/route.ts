import { NextRequest, NextResponse } from "next/server";

/** POST /api/xspaces/speaker-request — request to speak. Body: { space_id: string, message?: string }. Delegates to POST /api/spaces/[id]/speaker-request */
export async function POST(request: NextRequest) {
  let body: { space_id?: string; message?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const spaceId = typeof body.space_id === "string" ? body.space_id.trim() : null;
  if (!spaceId) return NextResponse.json({ error: "space_id required" }, { status: 400 });

  const base = request.nextUrl.origin;
  const authHeader = request.headers.get("authorization");
  const res = await fetch(`${base}/api/spaces/${encodeURIComponent(spaceId)}/speaker-request`, {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: JSON.stringify({ message: body.message }),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
