/**
 * GET /api/invites/lineage — inviter chain and downstream invitees for the current user.
 * Returns: { inviter: { id, username, display_name } | null, invitees: [ { id, username, display_name, depth?, invitees?: [] } ] }
 * Query: ?depth=1|2 (default 1 = direct only; 2 = include invitees of invitees)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  const depth = Math.min(Math.max(Number(request.nextUrl.searchParams.get("depth")) || 1, 1), 3);

  const { data: myProfile, error: myErr } = await supabase
    .from("profiles")
    .select("id, inviter_id, username, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (myErr || !myProfile) return NextResponse.json({ me: null, inviter: null, invitees: [] });

  const me = {
    id: (myProfile as { id: string }).id,
    username: (myProfile as { username?: string | null }).username ?? null,
    display_name: (myProfile as { display_name?: string | null }).display_name ?? null,
  };
  const ADMIN_TWITTER = "muazxinthi";
  const inviterId = (myProfile as { inviter_id?: string | null }).inviter_id;
  let inviter: { id: string; username: string | null; display_name: string | null } | null = null;
  if (inviterId) {
    const { data: inv } = await supabase
      .from("profiles")
      .select("id, username, display_name, twitter_username")
      .eq("id", inviterId)
      .maybeSingle();
    if (inv) {
      const tw = ((inv as { twitter_username?: string | null }).twitter_username ?? "").replace(/^@/, "").toLowerCase();
      const displayName = tw === ADMIN_TWITTER ? "Linkary" : (inv.display_name ?? inv.username ?? null);
      inviter = { id: inv.id, username: inv.username ?? null, display_name: displayName };
    }
  }

  async function getInvitees(profileId: string, d: number): Promise<{ id: string; username: string | null; display_name: string | null; depth: number; invitees?: any[] }[]> {
    const { data: rows } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("inviter_id", profileId);
    const list = (rows ?? []).map((r: { id: string; username: string | null; display_name: string | null }) => ({
      id: r.id,
      username: r.username ?? null,
      display_name: r.display_name ?? null,
      depth: d,
    })) as { id: string; username: string | null; display_name: string | null; depth: number; invitees?: any[] }[];
    if (d < depth && list.length > 0) {
      for (const item of list) {
        item.invitees = await getInvitees(item.id, d + 1);
      }
    }
    return list;
  }

  const invitees = await getInvitees(user.id, 1);
  return NextResponse.json({ me, inviter, invitees });
}
