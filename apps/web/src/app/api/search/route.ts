import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Sanitize q for Supabase .or() usage: allow only [a-zA-Z0-9 _-], trim, collapse spaces. */
function sanitizeSearchQuery(q: string): string {
  const allowed = q.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  return allowed.replace(/\s+/g, " ");
}

/** GET /api/search?q=...&filter=all|people|projects|agencies
 * Real search over public_profile_view and public_org_view.
 * Ranked: starts-with first, then contains. Returns url for navigation; no xscore in response.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q")?.trim() || "";
  const q = sanitizeSearchQuery(rawQ);
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

  type SearchResult = {
    id: string;
    type: "person" | "project" | "agency";
    name: string;
    handleLabel: string;
    url: string;
    avatar: string;
    verified: boolean;
    rank: number;
  };
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  const includePeople = filter === "all" || filter === "people";
  const includeOrgs = filter === "all" || filter === "projects" || filter === "agencies";

  if (includePeople) {
    const { data: profiles, error: profilesError } = await supabase
      .from("public_profile_view")
      .select("id, display_name, username, avatar_url, twitter_username")
      .or(`username.ilike.${term},display_name.ilike.${term},twitter_username.ilike.${term}`)
      .limit(15);

    if (profilesError) {
      console.error("[api/search] profiles error:", profilesError);
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    const list = (profiles || []) as { id: string; display_name: string | null; username: string | null; avatar_url: string | null; twitter_username: string | null }[];
    for (const p of list) {
      if (!p.username) continue;
      const key = `person:${p.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const name = p.display_name || p.username || "Creator";
      const handleLabel = `@${p.username}`;
      const url = `/${p.username}`;
      const rank = [p.username, p.display_name, p.twitter_username].some(
        (f) => f != null && f.toLowerCase().startsWith(termLower)
      )
        ? 1
        : 2;
      results.push({
        id: p.id,
        type: "person",
        name,
        handleLabel,
        url,
        avatar: p.avatar_url || "",
        verified: false,
        rank,
      });
    }
  }

  if (includeOrgs) {
    const { data: orgs, error: orgsError } = await supabase
      .from("public_org_view")
      .select("id, name, slug, logo_url, org_type, twitter_username")
      .or(`name.ilike.${term},slug.ilike.${term},twitter_username.ilike.${term}`)
      .limit(15);

    if (orgsError) {
      console.error("[api/search] orgs error:", orgsError);
      return NextResponse.json({ error: orgsError.message }, { status: 500 });
    }

    const list = (orgs || []) as { id: string; name: string; slug: string; logo_url: string | null; org_type: string; twitter_username: string | null }[];
    for (const o of list) {
      if (!o.slug) continue;
      const type = o.org_type === "agency" ? "agency" : "project";
      if (filter === "agencies" && type !== "agency") continue;
      if (filter === "projects" && type !== "project") continue;
      const key = `${type}:${o.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const url = `/p/${o.slug}`;
      const handleLabel = url;
      const rank = [o.slug, o.name, o.twitter_username].some(
        (f) => f != null && String(f).toLowerCase().startsWith(termLower)
      )
        ? 1
        : 2;
      results.push({
        id: o.id,
        type,
        name: o.name,
        handleLabel,
        url,
        avatar: o.logo_url || "",
        verified: false,
        rank,
      });
    }
  }

  results.sort((a, b) => a.rank - b.rank);
  const out = results.slice(0, 20).map(({ rank: _r, ...r }) => r);

  return NextResponse.json({ results: out });
}
