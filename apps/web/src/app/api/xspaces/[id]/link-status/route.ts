/**
 * GET /api/xspaces/[id]/link-status — link state for a space.
 * Response: { linked: boolean, x_space_id: string|null, x_space_url: string|null }.
 * Public; no tokens returned.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const spaceId = (await params).id;
  if (!spaceId || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: space, error } = await supabase
    .from("spaces")
    .select("x_space_id, x_space_url")
    .eq("id", spaceId)
    .maybeSingle();

  if (error || !space) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }

  const row = space as { x_space_id: string | null; x_space_url: string | null };
  const linked = !!(row.x_space_id ?? row.x_space_url);
  return NextResponse.json({
    linked,
    x_space_id: row.x_space_id ?? null,
    x_space_url: row.x_space_url ?? null,
  });
}
