import { createClient } from "@supabase/supabase-js";
import { ok } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * GET /api/health — uptime check. No auth. Fast.
 */
export async function GET() {
  const ts = new Date().toISOString();
  let db: string | undefined;
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const client = createClient(supabaseUrl, supabaseServiceKey);
      const { error } = await client.from("profiles").select("id", { count: "exact", head: true }).limit(1);
      db = error ? "error" : "ok";
    } catch {
      db = "error";
    }
  }
  return ok({ status: "ok", ts, ...(db !== undefined && { db }) });
}
