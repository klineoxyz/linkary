import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET /api/notifications?limit=20&cursor=...
 * Returns notifications for current user, newest first. Pagination via cursor (created_at).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const cursor = searchParams.get("cursor");

  let q = supabase
    .from("notifications")
    .select("id, type, entity_type, entity_id, payload, read_at, created_at")
    .eq("recipient_profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (cursor) {
    q = q.lt("created_at", cursor);
  }
  const { data: rows, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const list = (rows ?? []) as Array<{ id: string; type: string; entity_type: string | null; entity_id: string | null; payload: Record<string, unknown>; read_at: string | null; created_at: string }>;
  const hasMore = list.length > limit;
  const notifications = hasMore ? list.slice(0, limit) : list;
  const nextCursor = hasMore ? notifications[notifications.length - 1]?.created_at : null;
  const unreadCount = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", user.id)
    .is("read_at", null);
  return NextResponse.json({
    notifications,
    nextCursor,
    unreadCount: unreadCount.count ?? 0,
  });
}
