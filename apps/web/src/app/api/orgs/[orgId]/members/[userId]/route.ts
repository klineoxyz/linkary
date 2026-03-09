import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** DELETE: Remove member (self or org admin). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }
  const { orgId, userId: targetUserId } = await params;
  if (!orgId || !targetUserId) {
    return fail("BAD_REQUEST", "orgId and userId required", 400);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId, p_uid: user.id });
  const isSelf = user.id === targetUserId;
  if (!isAdmin && !isSelf) {
    return fail("FORBIDDEN", "Only org admin can remove others; you can leave yourself", 403);
  }

  const { error: deleteErr } = await supabase
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  if (deleteErr) {
    if (deleteErr.message?.includes("at least one owner")) {
      return fail("BAD_REQUEST", "Organization must have at least one owner", 400);
    }
    return fail("INTERNAL", deleteErr.message, 500);
  }
  return ok();
}

/** PATCH: Update member role. Body: { role: 'member' | 'admin' | 'owner' }. Caller must be org admin. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }
  const { orgId, userId: targetUserId } = await params;
  if (!orgId || !targetUserId) {
    return fail("BAD_REQUEST", "orgId and userId required", 400);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId, p_uid: user.id });
  if (!isAdmin) return fail("FORBIDDEN", "Only org owner or admin can change roles", 403);

  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const role = body?.role === "admin" || body?.role === "member" ? body.role : null;
  if (!role) {
    return fail("BAD_REQUEST", "role must be admin or member. Use transfer ownership to change owner.", 400);
  }

  if (role === "admin") {
    const { data: currentRow } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    const wasAlreadyAdmin = (currentRow as { role?: string } | null)?.role === "admin";
    if (!wasAlreadyAdmin) {
      const { count } = await supabase
        .from("org_members")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "admin");
      if (typeof count === "number" && count >= 2) {
        return fail("BAD_REQUEST", "This org already has 2 admins. Remove or demote an admin first.", 400);
      }
    }
  }

  const { error: updateErr } = await supabase
    .from("org_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  if (updateErr) {
    if (updateErr.message?.includes("at least one owner")) {
      return fail("BAD_REQUEST", "Organization must have at least one owner", 400);
    }
    return fail("INTERNAL", updateErr.message, 500);
  }
  return ok();
}
