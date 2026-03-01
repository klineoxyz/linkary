/**
 * PATCH: Update a partner program (ownership required).
 * DELETE: Delete a partner program (ownership required).
 * Rate limits: 30/10min per user for write.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeUrl } from "@/lib/sanitizeUrl";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

const PARTNERS_WRITE_LIMIT = 30;
const WINDOW_SECONDS = 600;

type ProgramType = "affiliate" | "ambassador";

function parseProgramType(v: string | null): ProgramType | null {
  if (v === "affiliate" || v === "ambassador") return v;
  return null;
}

async function assertOwnership(supabase: SupabaseClient, id: string, userId: string): Promise<"ok" | NextResponse> {
  const { data, error } = await supabase
    .from("partner_programs")
    .select("owner_type, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { owner_type: string; owner_id: string } | null;
  if (!row) return fail("NOT_FOUND", "Partner program not found.", 404);
  const ownerType = row.owner_type;
  const ownerId = row.owner_id;
  if (ownerType === "profile") {
    if (ownerId !== userId) return fail("FORBIDDEN", "You can only edit your own partner programs.", 403);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: isAdmin } = await (supabase as any).rpc("is_org_admin", { p_org_id: ownerId, p_uid: userId });
    if (!isAdmin) return fail("FORBIDDEN", "Only org owner or admin can edit this.", 403);
  }
  return "ok";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);

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

  const ownership = await assertOwnership(supabase, id, user.id);
  if (ownership !== "ok") return ownership;

  let body: {
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

  const updates: Record<string, unknown> = {};
  if (body?.programType != null) {
    const pt = parseProgramType(body.programType);
    if (pt) updates.program_type = pt;
  }
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (name) updates.name = name;
  }
  if (body?.websiteUrl !== undefined) {
    updates.website_url = typeof body.websiteUrl === "string" ? sanitizeUrl(body.websiteUrl.trim() || null) ?? null : null;
  }
  if (body?.logoUrl !== undefined) {
    updates.logo_url = typeof body.logoUrl === "string" ? sanitizeUrl(body.logoUrl.trim() || null) ?? null : null;
  }
  if (body?.description !== undefined) {
    updates.description = typeof body.description === "string" ? body.description.trim().slice(0, 280) || null : null;
  }
  if (body?.sinceDate !== undefined) {
    updates.since_date = typeof body.sinceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.sinceDate.trim()) ? body.sinceDate.trim() : null;
  }
  if (typeof body?.isFeatured === "boolean") updates.is_featured = body.isFeatured;
  if (typeof body?.sortOrder === "number" && Number.isFinite(body.sortOrder)) updates.sort_order = Math.round(body.sortOrder);
  if (body?.targetProfileId !== undefined) {
    updates.target_profile_id =
      body.targetProfileId === null || body.targetProfileId === ""
        ? null
        : typeof body.targetProfileId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.targetProfileId.trim())
          ? body.targetProfileId.trim()
          : undefined;
    if (updates.target_profile_id === undefined) delete updates.target_profile_id;
  }

  const selectCols = "id, owner_type, owner_id, program_type, name, website_url, logo_url, logo_file_path, description, since_date, is_featured, sort_order, target_profile_id, created_at, updated_at";
  if (Object.keys(updates).length === 0) {
    const { data: row } = await supabase.from("partner_programs").select(selectCols).eq("id", id).single();
    return ok({ partner: row });
  }

  const { data: row, error } = await supabase
    .from("partner_programs")
    .update(updates)
    .eq("id", id)
    .select(selectCols)
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ partner: row });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = _request.headers.get("authorization");
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

  const { id } = await params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);

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

  const ownership = await assertOwnership(supabase, id, user.id);
  if (ownership !== "ok") return ownership;

  const { error } = await supabase.from("partner_programs").delete().eq("id", id);
  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ deleted: true });
}
