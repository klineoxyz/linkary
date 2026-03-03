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

  const spaceCols = "id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at, x_space_id";
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
    let q = supabase
      .from("spaces")
      .select(spaceCols)
      .in("status", ["scheduled", "live"])
      .order("scheduled_at", { ascending: true })
      .limit(100);
    if (upcoming) {
      q = q.gte("scheduled_at", new Date().toISOString());
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
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const status = body.status === "planned" ? "planned" : "scheduled";
  let description = typeof body.description === "string" ? body.description.trim() || null : null;
  if (typeof body.cohosts === "string" && body.cohosts.trim()) {
    description = description ? `${description}\nCohosts: ${body.cohosts.trim()}` : `Cohosts: ${body.cohosts.trim()}`;
  }

  const { data, error } = await supabase
    .from("spaces")
    .insert({
      host_profile_id: user.id,
      title,
      description,
      scheduled_at: body.scheduled_at || null,
      duration_mins: typeof body.duration_mins === "number" ? body.duration_mins : null,
      status,
      updated_at: new Date().toISOString(),
    })
    .select("id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at, x_space_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
