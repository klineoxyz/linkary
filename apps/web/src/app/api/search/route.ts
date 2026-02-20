import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET /api/search?q=...&filter=all|people|projects|agencies
 * Real search over public_profile_view and public_org_view.
 * Ranked: starts-with (username/slug/name) first, then contains.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const filter = searchParams.get("filter") || "all";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ results: [], error: "Search not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const term = `%${q}%`;
  const termLower = q.toLowerCase();

  type SearchResult = { id: string; type: "person" | "project" | "agency"; name: string; handle: string; avatar: string; verified: boolean; xscore?: number; rank: number };
  const results: SearchResult[] = [];

  const includePeople = filter === "all" || filter === "people";
  const includeOrgs = filter === "all" || filter === "projects" || filter === "agencies";

  if (includePeople) {
    const { data: profiles } = await supabase
      .from("public_profile_view")
      .select("id, display_name, username, avatar_url, twitter_username, xscore")
      .or(`username.ilike.${term},display_name.ilike.${term},twitter_username.ilike.${term}`)
      .limit(15);

    const list = (profiles || []) as { id: string; display_name: string | null; username: string | null; avatar_url: string | null; twitter_username: string | null; xscore: number | null }[];
    for (const p of list) {
      const name = p.display_name || p.username || "Creator";
      const handle = p.username ? `@${p.username}` : "";
      const rank = [p.username, p.display_name, p.twitter_username].some(
        (f) => f && f.toLowerCase().startsWith(termLower)
      )
        ? 1
        : 2;
      results.push({
        id: p.id,
        type: "person",
        name,
        handle,
        avatar: p.avatar_url || "",
        verified: false,
        xscore: p.xscore ?? undefined,
        rank,
      });
    }
  }

  if (includeOrgs) {
    const { data: orgs } = await supabase
      .from("public_org_view")
      .select("id, name, slug, logo_url, org_type, twitter_username, xscore")
      .or(`name.ilike.${term},slug.ilike.${term},twitter_username.ilike.${term}`)
      .limit(15);

    const list = (orgs || []) as { id: string; name: string; slug: string; logo_url: string | null; org_type: string; twitter_username: string | null; xscore: number | null }[];
    for (const o of list) {
      const type = o.org_type === "agency" ? "agency" : "project";
      if (filter === "agencies" && type !== "agency") continue;
      if (filter === "projects" && type !== "project") continue;
      const handle = o.slug ? `/p/${o.slug}` : "";
      const rank = [o.slug, o.name, o.twitter_username].some(
        (f) => f && String(f).toLowerCase().startsWith(termLower)
      )
        ? 1
        : 2;
      results.push({
        id: o.id,
        type,
        name: o.name,
        handle,
        avatar: o.logo_url || "",
        verified: false,
        xscore: o.xscore ?? undefined,
        rank,
      });
    }
  }

  results.sort((a, b) => a.rank - b.rank);
  const out = results.slice(0, 20).map(({ rank: _r, ...r }) => r);

  return NextResponse.json({ results: out });
}
