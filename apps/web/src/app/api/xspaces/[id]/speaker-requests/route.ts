/**
 * GET /api/xspaces/[id]/speaker-requests — list speaker requests for a space (host sees all; requester sees own).
 * Returns pitch, topic, profile display info; approved_count for the space.
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
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!spaceId || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {});

  const { data: approvedList } = await supabase
    .from("speaker_requests")
    .select("id")
    .eq("space_id", spaceId)
    .eq("status", "approved");
  const approved_count = Array.isArray(approvedList) ? approvedList.length : 0;

  const { data: rows, error } = await supabase
    .from("speaker_requests")
    .select("id, requester_profile_id, status, pitch, topic, message, created_at, updated_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (rows ?? []) as Array<{
    id: string;
    requester_profile_id: string;
    status: string;
    pitch: string | null;
    topic: string | null;
    message: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  const profileIds = [...new Set(list.map((r) => r.requester_profile_id))];
  type ProfileRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
  let withProfiles = list.map((r) => ({ ...r, username: null as string | null, display_name: null as string | null, avatar_url: null as string | null }));

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", profileIds);
    const byId = new Map((profiles ?? []).map((p) => [(p as ProfileRow).id, p as ProfileRow]));
    withProfiles = list.map((r) => {
      const p = byId.get(r.requester_profile_id);
      return {
        ...r,
        username: p?.username ?? null,
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
      };
    });
  }

  return NextResponse.json({ requests: withProfiles, approved_count });
}
