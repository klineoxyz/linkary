import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET /api/landing/featured — returns a few public profiles and orgs for landing hero (no mock data). */
export async function GET() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ profiles: [], orgs: [] });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const [profilesRes, orgsRes] = await Promise.all([
    supabase.from("public_profile_view").select("id, display_name, username, avatar_url, xscore").limit(4).order("updated_at", { ascending: false }),
    supabase.from("public_org_view").select("id, name, slug, logo_url, org_type, xscore").limit(2).order("updated_at", { ascending: false }),
  ]);
  return NextResponse.json({
    profiles: profilesRes.data ?? [],
    orgs: orgsRes.data ?? [],
  });
}
