import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase server env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
}
/**
 * Supabase admin client (service role).
 * Server-only. Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
});
//# sourceMappingURL=supabase.js.map