/**
 * POST /api/xspaces/link-space — host links a chosen X Space to their Linkary space.
 * Body: { space_id: string, x_space_id: string, force?: boolean }. force: true allows overwriting existing link.
 * Returns 409 ALREADY_LINKED when space already has x_space_id and force is not true.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { space_id?: string; x_space_id?: string; force?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const spaceId = typeof body.space_id === "string" ? body.space_id.trim() : null;
  const xSpaceId = typeof body.x_space_id === "string" ? body.x_space_id.trim() : null;
  const force = body.force === true;
  if (!spaceId || !xSpaceId) {
    return NextResponse.json({ error: "space_id and x_space_id required" }, { status: 400 });
  }

  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .select("id, host_profile_id, x_space_id, x_space_url")
    .eq("id", spaceId)
    .maybeSingle();

  if (spaceError || !space) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }
  const row = space as { host_profile_id: string; x_space_id: string | null; x_space_url: string | null };
  if (row.host_profile_id !== user.id) {
    return NextResponse.json({ error: "Only the host can link an X Space" }, { status: 403 });
  }

  const alreadyLinked = !!(row.x_space_id ?? row.x_space_url);
  if (alreadyLinked && !force) {
    return NextResponse.json(
      {
        error: "This space is already linked to an X Space. Use Replace to change it.",
        code: "ALREADY_LINKED",
        x_space_id: row.x_space_id ?? null,
        x_space_url: row.x_space_url ?? null,
      },
      { status: 409 }
    );
  }

  const xSpaceUrl = `https://x.com/i/spaces/${xSpaceId}`;
  const { error: updateError } = await supabase
    .from("spaces")
    .update({
      x_space_id: xSpaceId,
      x_space_url: xSpaceUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", spaceId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    space_id: spaceId,
    x_space_id: xSpaceId,
    x_space_url: xSpaceUrl,
  });
}
