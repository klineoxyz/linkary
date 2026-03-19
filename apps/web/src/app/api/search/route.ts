import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isPrivateStorageUrl } from "@/lib/isPrivateStorageUrl";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Sanitize q for Supabase .or() usage: allow only [a-zA-Z0-9 _-], trim, collapse spaces. */
function sanitizeSearchQuery(q: string): string {
  const allowed = q.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  return allowed.replace(/\s+/g, " ");
}

/** GET /api/search?q=...&filter=all|people|projects|agencies&professions=slug1,slug2&followers_min=&followers_max=&engagement_min=&engagement_max=&ecosystem=
 * Real search with optional filters: professions (people), followers/engagement range (people), ecosystem (orgs).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q")?.trim() || "";
  const q = sanitizeSearchQuery(rawQ);
  const filter = searchParams.get("filter") || "all";
  const professionsParam = searchParams.get("professions")?.trim() || "";
  const professions = professionsParam ? professionsParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
  const followersMin = searchParams.get("followers_min")?.trim();
  const followersMax = searchParams.get("followers_max")?.trim();
  const engagementMin = searchParams.get("engagement_min")?.trim();
  const engagementMax = searchParams.get("engagement_max")?.trim();
  const ecosystemParam = searchParams.get("ecosystem")?.trim() || "";
  const ecosystem = ecosystemParam ? ecosystemParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];

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

  let profileIdsByProfession: string[] | null = null;
  if (includePeople && professions.length > 0) {
    const { data: profs } = await supabase.from("professions").select("id").in("slug", professions);
    const ids = (profs ?? []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      const { data: pp } = await supabase.from("profile_professions").select("profile_id").in("profession_id", ids);
      profileIdsByProfession = [...new Set((pp ?? []).map((r: { profile_id: string }) => r.profile_id))];
    }
  }

  let orgIdsByEcosystem: string[] | null = null;
  if (includeOrgs && ecosystem.length > 0) {
    const orClause = ecosystem.map((e) => `category.ilike.%${e}%`).join(",");
    const { data: catRows } = await supabase.from("org_ecosystem_categories").select("org_id").or(orClause);
    orgIdsByEcosystem = catRows ? [...new Set((catRows as { org_id: string }[]).map((r) => r.org_id))] : [];
  }

  // Numeric filters: followers_total is numeric/bigint; avg_engagement_rate in view is 0-1 (percentage as fraction)
  const followersMinNum = followersMin !== "" && followersMin != null ? Number(followersMin) : null;
  const followersMaxNum = followersMax !== "" && followersMax != null ? Number(followersMax) : null;
  const engagementMinNum = engagementMin !== "" && engagementMin != null ? Number(engagementMin) : null;
  const engagementMaxNum = engagementMax !== "" && engagementMax != null ? Number(engagementMax) : null;

  if (includePeople) {
    let qPeople = supabase
      .from("public_profile_view")
      .select("id, display_name, username, avatar_url, twitter_username, followers_total, avg_engagement_rate")
      .or(`username.ilike.${term},display_name.ilike.${term},twitter_username.ilike.${term}`)
      .limit(50);
    if (profileIdsByProfession != null && profileIdsByProfession.length > 0) {
      qPeople = qPeople.in("id", profileIdsByProfession);
    }
    if (followersMinNum != null && Number.isFinite(followersMinNum)) {
      qPeople = qPeople.gte("followers_total", followersMinNum);
    }
    if (followersMaxNum != null && Number.isFinite(followersMaxNum)) {
      qPeople = qPeople.lte("followers_total", followersMaxNum);
    }
    // Engagement: view exposes 0-1 (fraction); filter params are 0-100 percentage points
    if (engagementMinNum != null && Number.isFinite(engagementMinNum)) {
      qPeople = qPeople.gte("avg_engagement_rate", engagementMinNum / 100);
    }
    if (engagementMaxNum != null && Number.isFinite(engagementMaxNum)) {
      qPeople = qPeople.lte("avg_engagement_rate", engagementMaxNum / 100);
    }
    const { data: profiles, error: profilesError } = await qPeople;

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
        avatar: p.avatar_url && !isPrivateStorageUrl(p.avatar_url) ? p.avatar_url : "",
        verified: false,
        rank,
      });
    }
  }

  if (includeOrgs) {
    let qOrgs = supabase
      .from("public_org_view")
      .select("id, name, slug, logo_url, org_type, twitter_username")
      .or(`name.ilike.${term},slug.ilike.${term},twitter_username.ilike.${term}`)
      .limit(50);
    if (orgIdsByEcosystem != null && orgIdsByEcosystem.length > 0) {
      qOrgs = qOrgs.in("id", orgIdsByEcosystem);
    }
    const { data: orgs, error: orgsError } = await qOrgs;

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
      const url = `/org/${encodeURIComponent(o.slug)}`;
      const handleLabel = `/${o.slug}`;
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
        avatar: o.logo_url && !isPrivateStorageUrl(o.logo_url) ? o.logo_url : "",
        verified: false,
        rank,
      });
    }
  }

  results.sort((a, b) => a.rank - b.rank);
  const out = results.slice(0, 20).map(({ rank: _r, ...r }) => r);

  return NextResponse.json({ results: out });
}
