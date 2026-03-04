import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST /api/xspaces/rsvp — set RSVP (interested | going). Body: { space_id: string, status: "interested" | "going" } */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { space_id?: string; status?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const spaceId = typeof body.space_id === "string" ? body.space_id.trim() : null;
  const status = body.status === "going" ? "going" : "interested";
  if (!spaceId) return NextResponse.json({ error: "space_id required" }, { status: 400 });

  const { data: space } = await supabase.from("spaces").select("id").eq("id", spaceId).maybeSingle();
  if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("space_rsvps")
    .upsert(
      { space_id: spaceId, profile_id: user.id, status },
      { onConflict: "space_id,profile_id" }
    )
    .select("id, space_id, profile_id, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
