/**
 * GET /api/xspaces/[id]/host-and-speakers — host + approved speakers with profile (avatar, name, handle).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type ProfilePayload = { id: string; display_name: string | null; twitter_username: string | null; profile_image_url: string | null };

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

  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .select("id, host_profile_id")
    .eq("id", spaceId)
    .single();

  if (spaceError || !space) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }

  const hostProfileId = space.host_profile_id as string;
  const hostCols = "id, display_name, twitter_username, avatar_url";
  const { data: hostRow } = await supabase.from("profiles").select(hostCols).eq("id", hostProfileId).single();
  const host: ProfilePayload = hostRow
    ? {
        id: hostRow.id,
        display_name: hostRow.display_name ?? null,
        twitter_username: hostRow.twitter_username ?? null,
        profile_image_url: hostRow.avatar_url ?? null,
      }
    : { id: hostProfileId, display_name: null, twitter_username: null, profile_image_url: null };

  const { data: approved } = await supabase
    .from("speaker_requests")
    .select("requester_profile_id")
    .eq("space_id", spaceId)
    .eq("status", "approved");

  const speakerIds = [...new Set((approved ?? []).map((r) => r.requester_profile_id))];
  let speakers: ProfilePayload[] = [];
  if (speakerIds.length > 0) {
    const { data: profileRows } = await supabase.from("profiles").select(hostCols).in("id", speakerIds);
    speakers = (profileRows ?? []).map((p: { id: string; display_name: string | null; twitter_username: string | null; avatar_url: string | null }) => ({
      id: p.id,
      display_name: p.display_name ?? null,
      twitter_username: p.twitter_username ?? null,
      profile_image_url: p.avatar_url ?? null,
    }));
  }

  return NextResponse.json({ host, speakers });
}
