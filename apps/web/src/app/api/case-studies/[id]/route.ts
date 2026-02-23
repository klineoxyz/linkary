/**
 * PATCH: Update a case study (title, description, proof_url). Ownership required.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { sanitizeUrl } from "@/lib/sanitizeUrl";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function assertOwnership(supabase: SupabaseClient, id: string, userId: string): Promise<"ok" | NextResponse> {
  const { data, error } = await supabase
    .from("case_studies")
    .select("owner_type, owner_profile_id, owner_org_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { owner_type: string; owner_profile_id: string | null; owner_org_id: string | null } | null;
  if (!row) return fail("NOT_FOUND", "Case study not found.", 404);
  if (row.owner_type === "profile") {
    if (row.owner_profile_id !== userId) return fail("FORBIDDEN", "You can only edit your own case studies.", 403);
  } else {
    const ownerOrgId = row.owner_org_id;
    if (!ownerOrgId) return fail("FORBIDDEN", "Invalid case study owner.", 403);
    const { data: isAdmin } = await (supabase as unknown as { rpc: (n: string, p: { p_org_id: string; p_uid: string }) => Promise<{ data: boolean | null }> }).rpc("is_org_admin", { p_org_id: ownerOrgId, p_uid: userId });
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

  const ownership = await assertOwnership(supabase, id, user.id);
  if (ownership !== "ok") return ownership;

  let body: { title?: string; description?: string; proof_url?: string } | null = null;
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const updates: { title?: string | null; description?: string | null; proof_url?: string | null } = {};
  if (body && typeof body.title !== "undefined") {
    updates.title = typeof body.title === "string" ? body.title.trim() || null : null;
  }
  if (body && typeof body.description !== "undefined") {
    updates.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }
  if (body && typeof body.proof_url !== "undefined") {
    const raw = typeof body.proof_url === "string" ? body.proof_url.trim() : "";
    updates.proof_url = raw ? sanitizeUrl(raw) ?? null : null;
  }

  if (Object.keys(updates).length === 0) {
    const { data: existing } = await supabase.from("case_studies").select("id, title, description, proof_url, owner_type, owner_profile_id, owner_org_id, created_at").eq("id", id).single();
    if (existing) return ok({ caseStudy: existing });
    return fail("NOT_FOUND", "Case study not found.", 404);
  }

  const { data: updated, error } = await supabase
    .from("case_studies")
    .update(updates)
    .eq("id", id)
    .select("id, title, description, proof_url, owner_type, owner_profile_id, owner_org_id, created_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ caseStudy: updated });
}
