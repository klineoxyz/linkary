import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/orgs/[orgId]/transfer-owner
 * Body: { new_owner_user_id: string }. Only the current org owner can call.
 * Promotes new_owner to owner and demotes caller to admin. Org must never have zero owners.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const { orgId } = await params;
  if (!orgId) return fail("BAD_REQUEST", "orgId required", 400);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const { data: myMembership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  const myRole = (myMembership as { role?: string } | null)?.role;
  if (myRole !== "owner") {
    return fail("FORBIDDEN", "Only the current owner can transfer ownership", 403);
  }

  let body: { new_owner_user_id?: string };
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const newOwnerId = typeof body?.new_owner_user_id === "string" ? body.new_owner_user_id.trim() : null;
  if (!newOwnerId) {
    return fail("BAD_REQUEST", "new_owner_user_id is required", 400);
  }
  if (newOwnerId === user.id) {
    return ok();
  }

  const { data: targetMembership } = await supabase
    .from("org_members")
    .select("id, role")
    .eq("org_id", orgId)
    .eq("user_id", newOwnerId)
    .maybeSingle();
  if (!targetMembership) {
    return fail("BAD_REQUEST", "User is not a member of this org. Add them first, then transfer ownership.", 400);
  }

  const { error: updateNew } = await supabase
    .from("org_members")
    .update({ role: "owner" })
    .eq("org_id", orgId)
    .eq("user_id", newOwnerId);
  if (updateNew) {
    return fail("INTERNAL", updateNew.message, 500);
  }

  const { error: updateSelf } = await supabase
    .from("org_members")
    .update({ role: "admin" })
    .eq("org_id", orgId)
    .eq("user_id", user.id);
  if (updateSelf) {
    return fail("INTERNAL", updateSelf.message, 500);
  }

  return ok();
}
