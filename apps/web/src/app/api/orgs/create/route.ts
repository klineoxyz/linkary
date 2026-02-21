import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST: Create org via create_org_and_membership RPC (auth required).
 * Body: { name: string, slug?: string, tagline?: string, website?: string, twitter_username?: string, logo_url?: string, org_type: "company"|"brand"|"project"|"agency", parent_org_id?: string }
 * Returns { ok: true, orgId, slug } or { ok: false, code, message } for debugging.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "Missing auth or config" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ ok: false, code: "INVALID_SESSION", message: userError?.message ?? "Invalid session" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const org_type = typeof body?.org_type === "string" ? body.org_type.toLowerCase() : "";
  if (!name) {
    return NextResponse.json({ ok: false, code: "NAME_REQUIRED", message: "name is required" }, { status: 400 });
  }
  if (!["company", "brand", "project", "agency"].includes(org_type)) {
    return NextResponse.json({ ok: false, code: "INVALID_ORG_TYPE", message: "org_type must be one of: company, brand, project, agency" }, { status: 400 });
  }

  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") : undefined;
  const tagline = typeof body?.tagline === "string" ? body.tagline.trim() || undefined : undefined;
  const website = typeof body?.website === "string" ? body.website.trim() || undefined : undefined;
  const twitter_username = typeof body?.twitter_username === "string" ? body.twitter_username.trim().replace(/^@/, "") || undefined : undefined;
  const logo_url = typeof body?.logo_url === "string" ? body.logo_url.trim() || undefined : undefined;
  const parent_org_id = typeof body?.parent_org_id === "string" ? body.parent_org_id : undefined;

  const { data: raw, error } = await supabase.rpc("create_org_and_membership", {
    payload: {
      name,
      org_type,
      slug: slug && slug.length >= 2 ? slug : undefined,
      tagline,
      website,
      twitter_username,
      logo_url,
      parent_org_id: parent_org_id || undefined,
    },
  });

  if (error) {
    const code = error.code ?? "PGRST301";
    const message = error.message ?? "Create failed";
    return NextResponse.json(
      { ok: false, code, message },
      { status: code === "42501" || message.toLowerCase().includes("policy") ? 403 : 400 }
    );
  }

  const org = Array.isArray(raw) ? raw[0] : raw;
  if (!org?.id) {
    return NextResponse.json({ ok: false, code: "NO_ORG_RETURNED", message: "RPC did not return org" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    orgId: org.id,
    slug: org.slug ?? org.id,
  });
}
