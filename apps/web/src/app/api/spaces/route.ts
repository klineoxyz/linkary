import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET /api/spaces?mine=1&upcoming=1 | from=YYYY-MM-01&to=YYYY-MM-DD&scope=public
 * from/to: return spaces with scheduled_at in [from, to] (inclusive). scope=public filters status scheduled|live.
 * When logged in, also include mine=1 to merge in the user's spaces.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") === "1";
  const upcoming = searchParams.get("upcoming") === "1";
  const fromParam = searchParams.get("from")?.trim();
  const toParam = searchParams.get("to")?.trim();
  const scope = searchParams.get("scope")?.trim();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ spaces: [] });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {});

  const spaceCols = "id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at, x_space_id, x_space_url";
  const spaces: Array<{ id: string; host_profile_id: string; title: string; description: string | null; scheduled_at: string | null; duration_mins: number | null; status: string; created_at: string; x_space_id?: string | null }> = [];

  const useRange = fromParam && toParam && scope === "public";
  if (useRange) {
    const fromDate = new Date(fromParam + "T00:00:00.000Z");
    const toDate = new Date(toParam + "T23:59:59.999Z");
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime()) && fromDate <= toDate) {
      const { data, error } = await supabase
        .from("spaces")
        .select(spaceCols)
        .in("status", ["planned", "scheduled", "live"])
        .gte("scheduled_at", fromDate.toISOString())
        .lte("scheduled_at", toDate.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(500);
      if (!error) spaces.push(...(data ?? []));
    }
  }

  if (mine && token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user?.id) {
      const { data, error } = await supabase
        .from("spaces")
        .select(spaceCols)
        .eq("host_profile_id", user.id)
        .order("scheduled_at", { ascending: true })
        .limit(200);
      if (!error && data?.length) {
        const seen = new Set(spaces.map((s) => s.id));
        for (const s of data ?? []) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            spaces.push(s);
          }
        }
      }
    }
  }

  if (!useRange && !mine) {
    const now = new Date().toISOString();
    let q = supabase
      .from("spaces")
      .select(spaceCols)
      .in("status", ["planned", "scheduled", "live"])
      .order("scheduled_at", { ascending: true })
      .limit(100);
    if (upcoming) {
      q = q.or(`scheduled_at.gte."${now}",status.eq.live`);
    }
    const { data, error } = await q;
    if (!error) spaces.push(...(data ?? []));
  }

  spaces.sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  return NextResponse.json({ spaces });
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

  let body: { title?: string; description?: string; scheduled_at?: string; duration_mins?: number; status?: string; cohosts?: string; x_space_url?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ ok: false, code: "TITLE_REQUIRED", message: "title required" }, { status: 400 });
  if (title.length < 3) return NextResponse.json({ ok: false, code: "TITLE_TOO_SHORT", message: "Title must be at least 3 characters" }, { status: 400 });
  if (title.length > 120) return NextResponse.json({ ok: false, code: "TITLE_TOO_LONG", message: "Title must be at most 120 characters" }, { status: 400 });
  let description = typeof body.description === "string" ? body.description.trim() || null : null;
  if (description && description.length > 1000) return NextResponse.json({ ok: false, code: "DESCRIPTION_TOO_LONG", message: "Description must be at most 1000 characters" }, { status: 400 });
  if (typeof body.cohosts === "string" && body.cohosts.trim()) {
    description = description ? `${description}\nCohosts: ${body.cohosts.trim()}` : `Cohosts: ${body.cohosts.trim()}`;
    if (description.length > 1000) return NextResponse.json({ ok: false, code: "DESCRIPTION_TOO_LONG", message: "Description (with cohosts) must be at most 1000 characters" }, { status: 400 });
  }
  const status = body.status === "planned" ? "planned" : "scheduled";
  const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : null;
  if (scheduledAt && !isNaN(scheduledAt.getTime())) {
    const graceMs = 5 * 60 * 1000;
    if (scheduledAt.getTime() < Date.now() - graceMs) {
      return NextResponse.json({ ok: false, code: "SCHEDULED_IN_PAST", message: "Scheduled time must be in the future (within 5 min grace)" }, { status: 400 });
    }
  }

  const xSpaceUrl = typeof body.x_space_url === "string" ? body.x_space_url.trim() || null : null;
  const { data, error } = await supabase
    .from("spaces")
    .insert({
      host_profile_id: user.id,
      title,
      description,
      scheduled_at: body.scheduled_at || null,
      duration_mins: typeof body.duration_mins === "number" ? body.duration_mins : null,
      status,
      x_space_url: xSpaceUrl,
      updated_at: new Date().toISOString(),
    })
    .select("id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at, x_space_id, x_space_url")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
