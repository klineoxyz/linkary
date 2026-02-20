import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET /api/landing/featured — returns a few public profiles and orgs for landing hero (no mock data).
 * Views expose updated_at; only includes rows with username or display_name (profiles) and slug or name (orgs).
 */
export async function GET() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ profiles: [], orgs: [] });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const [profilesRes, orgsRes] = await Promise.all([
      supabase
        .from("public_profile_view")
        .select("id, display_name, username, avatar_url, xscore")
        .limit(6)
        .order("updated_at", { ascending: false }),
      supabase
        .from("public_org_view")
        .select("id, name, slug, logo_url, org_type, xscore")
        .limit(4)
        .order("updated_at", { ascending: false }),
    ]);

    const profiles = (profilesRes.data ?? []).filter(
      (p: { username?: string | null; display_name?: string | null }) => (p.username ?? p.display_name) != null
    );
    const orgs = (orgsRes.data ?? []).filter(
      (o: { slug?: string | null; name?: string | null }) => (o.slug ?? o.name) != null
    );

    return NextResponse.json({
      profiles: profiles.slice(0, 4),
      orgs: orgs.slice(0, 2),
    });
  } catch (e) {
    console.error("[api/landing/featured] error:", e);
    return NextResponse.json({ profiles: [], orgs: [] });
  }
}
