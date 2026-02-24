import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * POST: Create org via create_org_and_membership RPC (auth required).
 * Body: { name: string, slug?: string, tagline?: string, website?: string, twitter_username?: string, logo_url?: string, org_type: "company"|"brand"|"project"|"agency", parent_org_id?: string }
 * Returns { ok: true, orgId, slug } or { ok: false, code, message } for debugging.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Missing auth or config", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", userError?.message ?? "Invalid session", 401);
  }

  if (supabaseServiceKey) {
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const rl = await rateLimit({
      key: `orgs/create:u:${user.id}`,
      limit: 5,
      windowSeconds: 600,
      supabaseAdmin: service,
    });
    if (!rl.allowed) {
      return fail("RATE_LIMITED", "Too many requests. Please try again later.", 429, { resetAt: rl.resetAt });
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();
  const accountType = (profile as { account_type?: string } | null)?.account_type;
  if (accountType !== "company") {
    return fail("ORG_COMPANY_REQUIRED", "Only company accounts can create an organization.", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const org_type = typeof body?.org_type === "string" ? body.org_type.toLowerCase() : "";
  if (!name) {
    return fail("NAME_REQUIRED", "name is required", 400);
  }
  if (!["company", "brand", "project", "agency"].includes(org_type)) {
    return fail("INVALID_ORG_TYPE", "org_type must be one of: company, brand, project, agency", 400);
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
    return fail(code, message, code === "42501" || message.toLowerCase().includes("policy") ? 403 : 400);
  }

  const org = Array.isArray(raw) ? raw[0] : raw;
  if (!org?.id) {
    return fail("NO_ORG_RETURNED", "RPC did not return org", 500);
  }

  const parentId = parent_org_id ?? (org as { parent_org_id?: string }).parent_org_id;
  try {
    const { enqueueInfluenceRefresh } = await import("@/lib/refreshOrgInfluence");
    await enqueueInfluenceRefresh(org.id);
    if (parentId) await enqueueInfluenceRefresh(parentId);
  } catch (_) {
    /* non-blocking */
  }

  return ok({ orgId: org.id, slug: org.slug ?? org.id });
}
