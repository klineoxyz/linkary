import { NextRequest, NextResponse } from "next/server";
import { enqueueInfluenceRefresh } from "@/lib/refreshOrgInfluence";

/** POST: Refresh org influence rollup. Call after ambassador/affiliate/subsidiary/support changes.
 * Auth: CRON_SECRET (x-cron-secret or Bearer) or authenticated org member.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const orgId = (await params).orgId;
  const cronSecret = process.env.CRON_SECRET;
  const secret =
    _request.headers.get("x-cron-secret") ??
    _request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (cronSecret && secret === cronSecret) {
    await enqueueInfluenceRefresh(orgId);
    return NextResponse.json({ ok: true });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const token = _request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await enqueueInfluenceRefresh(orgId);
  return NextResponse.json({ ok: true });
}
