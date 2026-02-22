import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPublicEntityByUsername } from "@/lib/publicData";
import { normalizeIdentifier } from "@/lib/entityResolver";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/public/ownership?username=xxx
 * Returns { isOwner: boolean }. Auth required. Used so the public page never needs to send profile/id or org id to the client.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ isOwner: false }, { status: 200 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ isOwner: false }, { status: 200 });
  }

  const username = request.nextUrl.searchParams.get("username");
  const segment = (username ?? "").trim();
  if (!segment) {
    return NextResponse.json({ isOwner: false }, { status: 200 });
  }

  const norm = normalizeIdentifier(segment);
  const entity = await getPublicEntityByUsername(norm);
  if (!entity) {
    return NextResponse.json({ isOwner: false }, { status: 200 });
  }

  if (entity.type === "profile" && entity.profile?.id === user.id) {
    return NextResponse.json({ isOwner: true }, { status: 200 });
  }

  if (entity.type === "org" && entity.org?.id) {
    const { data: member } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", entity.org.id)
      .eq("user_id", user.id)
      .maybeSingle();
    const isOwner = !!member && ["owner", "admin"].includes((member as { role: string }).role);
    return NextResponse.json({ isOwner }, { status: 200 });
  }

  return NextResponse.json({ isOwner: false }, { status: 200 });
}
