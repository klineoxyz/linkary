import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
const OPS_ROLES = new Set(["ops_super", "ops_finance", "ops_support", "ops_readonly"]);

/**
 * GET /api/ops/check
 * Returns { allowed: true } only when request has valid Bearer session and active internal_ops_members role.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return ok({ allowed: false });
  }
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user?.id) {
    return ok({ allowed: false });
  }
  const service = createClient(supabaseUrl, supabaseServiceKey);
  const { data: member } = await service
    .from("internal_ops_members")
    .select("role")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();
  const role = typeof member?.role === "string" ? member.role : null;
  return ok({ allowed: role != null && OPS_ROLES.has(role) });
}
