/**
 * GET: List outgoing relations for current user (source_profile_id = me).
 * POST: Create relation (with type rules by source profile_type).
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const RELATION_TYPES = ["ambassador", "affiliate", "ecosystem", "subsidiary"] as const;
type RelationType = (typeof RELATION_TYPES)[number];

function allowedTypesForSource(sourceType: string): RelationType[] {
  if (sourceType === "individual") return ["ambassador", "affiliate"];
  if (sourceType === "project") return ["ambassador", "affiliate", "ecosystem", "subsidiary"];
  if (sourceType === "company") return ["ambassador", "affiliate", "subsidiary"];
  return [];
}

function targetAllowedForRelation(relationType: RelationType, targetType: string, sourceType: string): boolean {
  if (relationType === "ambassador" || relationType === "affiliate") {
    if (sourceType === "individual") return targetType === "project" || targetType === "company";
    return targetType === "individual" || targetType === "project" || targetType === "company";
  }
  if (relationType === "ecosystem" || relationType === "subsidiary") {
    if (sourceType === "company") return false;
    return targetType === "project" || targetType === "company";
  }
  return false;
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

  const sourceProfileId = getProfileIdForAuthUser(user.id);

  const { data: rows, error } = await supabase
    .from("profile_relations")
    .select("id, source_profile_id, target_profile_id, relation_type, is_public, sort_order, created_at, updated_at")
    .eq("source_profile_id", sourceProfileId)
    .order("relation_type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return fail("DB_ERROR", error.message, 500);
  const relations = (rows ?? []) as Array<{ id: string; target_profile_id: string; relation_type: string; is_public: boolean; sort_order: number; [k: string]: unknown }>;
  const targetIds = [...new Set(relations.map((r) => r.target_profile_id))];
  let targetById: Record<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string }> = {};
  if (targetIds.length > 0) {
    const { data: profiles } = await supabase.from("public_profile_view").select("id, username, display_name, avatar_url, profile_type").in("id", targetIds);
    for (const p of (profiles ?? []) as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string | null }>) {
      const username = (p.username ?? "").trim();
      if (username) targetById[p.id] = { id: p.id, username, display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null, profile_type: (p.profile_type ?? "individual") as string };
    }
  }
  const relationsWithTarget = relations.map((r) => ({ ...r, target_profile: targetById[r.target_profile_id] ?? null }));
  return ok({ relations: relationsWithTarget });
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

  const sourceProfileId = getProfileIdForAuthUser(user.id);

  const { data: sourceProfile } = await supabase
    .from("profiles")
    .select("profile_type")
    .eq("id", sourceProfileId)
    .maybeSingle();
  const sourceType = (sourceProfile as { profile_type?: string } | null)?.profile_type ?? "individual";

  let body: { target_profile_id?: string; relation_type?: string; is_public?: boolean };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const targetProfileId = typeof body?.target_profile_id === "string" ? body.target_profile_id.trim() : "";
  const relationType = typeof body?.relation_type === "string" ? body.relation_type.trim().toLowerCase() : "";
  if (!targetProfileId || !RELATION_TYPES.includes(relationType as RelationType)) {
    return fail("BAD_REQUEST", "target_profile_id and relation_type (ambassador|affiliate|ecosystem|subsidiary) required", 400);
  }

  const allowed = allowedTypesForSource(sourceType);
  if (!allowed.includes(relationType as RelationType)) {
    return fail("BAD_REQUEST", `Profile type ${sourceType} cannot create relation type ${relationType}`, 400);
  }

  if (targetProfileId === sourceProfileId) {
    return fail("BAD_REQUEST", "Cannot relate profile to itself", 400);
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("profile_type")
    .eq("id", targetProfileId)
    .maybeSingle();
  const targetType = (targetProfile as { profile_type?: string } | null)?.profile_type ?? "individual";

  if (!targetAllowedForRelation(relationType as RelationType, targetType, sourceType)) {
    return fail("BAD_REQUEST", `Target profile type ${targetType} not allowed for ${relationType}`, 400);
  }

  const is_public = typeof body?.is_public === "boolean" ? body.is_public : true;

  const { data: maxOrder } = await supabase
    .from("profile_relations")
    .select("sort_order")
    .eq("source_profile_id", sourceProfileId)
    .eq("relation_type", relationType)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = ((maxOrder as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const { data: row, error } = await supabase
    .from("profile_relations")
    .insert({
      source_profile_id: sourceProfileId,
      target_profile_id: targetProfileId,
      relation_type: relationType,
      is_public,
      sort_order,
      updated_at: new Date().toISOString(),
    })
    .select("id, source_profile_id, target_profile_id, relation_type, is_public, sort_order, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") return fail("BAD_REQUEST", "This relation already exists", 400);
    return fail("DB_ERROR", error.message, 500);
  }
  try {
    const { createServiceSupabase } = await import("@/lib/x-analytics-server");
    const { recomputeRepForProfiles } = await import("@/lib/repScore");
    await recomputeRepForProfiles([sourceProfileId, targetProfileId], createServiceSupabase());
  } catch {
    /* non-fatal */
  }
  return ok({ relation: row });
}
