/**
 * GET: List partner programs for the current user's profile or org (ownership required).
 * POST: Create a partner program (ownership required).
 * Rate limits: GET 60/10min, POST 30/10min per user.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeUrl } from "@/lib/sanitizeUrl";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

const PARTNERS_GET_LIMIT = 60;
const PARTNERS_WRITE_LIMIT = 30;
const WINDOW_SECONDS = 600;

type OwnerType = "profile" | "org";
type ProgramType = "affiliate" | "ambassador";

function parseOwnerType(v: string | null): OwnerType | null {
  if (v === "profile" || v === "org") return v;
  return null;
}

function parseProgramType(v: string | null): ProgramType | null {
  if (v === "affiliate" || v === "ambassador") return v;
  return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  if (supabaseServiceKey) {
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const rl = await rateLimit({
      key: `partners:get:u:${user.id}`,
      limit: PARTNERS_GET_LIMIT,
      windowSeconds: WINDOW_SECONDS,
      supabaseAdmin: service,
    });
    if (!rl.allowed) {
      return fail("RATE_LIMITED", "Too many requests.", 429, { resetAt: rl.resetAt });
    }
  }

  const { searchParams } = new URL(request.url);
  const ownerType = parseOwnerType(searchParams.get("ownerType"));
  const ownerId = searchParams.get("ownerId")?.trim() || null;
  if (!ownerType || !ownerId) {
    return fail("BAD_REQUEST", "ownerType and ownerId are required (ownerType=profile|org, ownerId=uuid)", 400);
  }

  if (ownerType === "profile") {
    if (ownerId !== user.id) {
      return fail("FORBIDDEN", "You can only list your own profile's partner programs.", 403);
    }
  } else {
    const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: ownerId, p_uid: user.id });
    if (!isAdmin) {
      return fail("FORBIDDEN", "Only org owner or admin can list this org's partner programs.", 403);
    }
  }

  const { data, error } = await supabase
    .from("partner_programs")
    .select("id, owner_type, owner_id, program_type, name, website_url, logo_url, logo_file_path, description, since_date, is_featured, sort_order, target_profile_id, created_at, updated_at")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return fail("DB_ERROR", error.message, 500);
  const rows = (data ?? []) as Array<{ target_profile_id?: string | null }>;
  const profileIds = [...new Set(rows.map((r) => r.target_profile_id).filter((id): id is string => !!id))];
  let usernameByProfileId: Record<string, string | null> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, username").in("id", profileIds);
    usernameByProfileId = (profiles ?? []).reduce(
      (acc, p) => {
        acc[p.id] = (p as { username: string | null }).username ?? null;
        return acc;
      },
      {} as Record<string, string | null>
    );
  }
  const partners = rows.map((r) => ({
    ...r,
    target_profile_username: r.target_profile_id ? usernameByProfileId[r.target_profile_id] ?? null : null,
  }));
  return ok({ partners });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  if (supabaseServiceKey) {
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const rl = await rateLimit({
      key: `partners:write:u:${user.id}`,
      limit: PARTNERS_WRITE_LIMIT,
      windowSeconds: WINDOW_SECONDS,
      supabaseAdmin: service,
    });
    if (!rl.allowed) {
      return fail("RATE_LIMITED", "Too many requests.", 429, { resetAt: rl.resetAt });
    }
  }

  let body: {
    ownerType?: string;
    ownerId?: string;
    programType?: string;
    name?: string;
    websiteUrl?: string | null;
    logoUrl?: string | null;
    description?: string | null;
    sinceDate?: string | null;
    isFeatured?: boolean;
    sortOrder?: number;
    targetProfileId?: string | null;
  };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const ownerType = parseOwnerType(body?.ownerType ?? null);
  const ownerId = typeof body?.ownerId === "string" ? body.ownerId.trim() : null;
  const programType = parseProgramType(body?.programType ?? null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!ownerType || !ownerId || !programType || !name) {
    return fail("BAD_REQUEST", "ownerType, ownerId, programType, and name are required.", 400);
  }

  if (ownerType === "profile") {
    if (ownerId !== user.id) {
      return fail("FORBIDDEN", "You can only add partner programs to your own profile.", 403);
    }
  } else {
    const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: ownerId, p_uid: user.id });
    if (!isAdmin) {
      return fail("FORBIDDEN", "Only org owner or admin can add partner programs.", 403);
    }
  }

  const websiteUrl = typeof body.websiteUrl === "string" ? sanitizeUrl(body.websiteUrl.trim() || null) ?? null : null;
  const logoUrl = typeof body.logoUrl === "string" ? sanitizeUrl(body.logoUrl.trim() || null) ?? null : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 280) || null : null;
  const sinceDate = typeof body.sinceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.sinceDate.trim()) ? body.sinceDate.trim() : null;
  const isFeatured = Boolean(body?.isFeatured);
  const sortOrder = typeof body?.sortOrder === "number" && Number.isFinite(body.sortOrder) ? Math.round(body.sortOrder) : 0;
  const rawTarget = body.targetProfileId;
  const targetProfileId =
    rawTarget === null || rawTarget === undefined || (typeof rawTarget === "string" && rawTarget.trim() === "")
      ? null
      : typeof rawTarget === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTarget.trim())
        ? rawTarget.trim()
        : null;

  const { data: row, error } = await supabase
    .from("partner_programs")
    .insert({
      owner_type: ownerType,
      owner_id: ownerId,
      program_type: programType,
      name,
      website_url: websiteUrl,
      logo_url: logoUrl,
      description,
      since_date: sinceDate,
      is_featured: isFeatured,
      sort_order: sortOrder,
      target_profile_id: targetProfileId,
    })
    .select("id, owner_type, owner_id, program_type, name, website_url, logo_url, logo_file_path, description, since_date, is_featured, sort_order, target_profile_id, created_at, updated_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ partner: row });
}
