import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET /api/spaces?mine=1&upcoming=1 — list spaces (my spaces or public upcoming) */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") === "1";
  const upcoming = searchParams.get("upcoming") === "1";
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ spaces: [] });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {});

  if (mine && token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user?.id) return NextResponse.json({ spaces: [] });
    const { data, error } = await supabase
      .from("spaces")
      .select("id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at")
      .eq("host_profile_id", user.id)
      .order("scheduled_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ spaces: data ?? [] });
  }

  let q = supabase
    .from("spaces")
    .select("id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at")
    .in("status", ["scheduled", "live"])
    .order("scheduled_at", { ascending: true })
    .limit(100);
  if (upcoming) {
    q = q.gte("scheduled_at", new Date().toISOString());
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ spaces: data ?? [] });
}

/** POST /api/spaces — create space (auth required) */
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

  let body: { title?: string; description?: string; scheduled_at?: string; duration_mins?: number } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("spaces")
    .insert({
      host_profile_id: user.id,
      title,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      scheduled_at: body.scheduled_at || null,
      duration_mins: typeof body.duration_mins === "number" ? body.duration_mins : null,
      status: "scheduled",
      updated_at: new Date().toISOString(),
    })
    .select("id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
