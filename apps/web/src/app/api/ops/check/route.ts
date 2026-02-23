import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/ops/check
 * Returns { allowed: true } if OPS_ENABLED is set (any value) OR request has valid Bearer session.
 * Never leaks OPS_ENABLED value; only boolean allowed.
 */
export async function GET(request: NextRequest) {
  const opsEnabled = typeof process.env.OPS_ENABLED === "string" && process.env.OPS_ENABLED.length > 0;
  if (opsEnabled) {
    return ok({ allowed: true });
  }
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return ok({ allowed: false });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.id) {
    return ok({ allowed: false });
  }
  return ok({ allowed: true });
}
