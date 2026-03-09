/**
 * GET: List org affiliates with profile (username, display_name). Auth required; RLS on org_affiliations.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? null;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);
  const { orgId } = await params;
  if (!orgId) return fail("BAD_REQUEST", "orgId required", 400);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: rows, error } = await supabase
    .from("org_affiliations")
    .select("id, org_id, profile_id, status, invited_by, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return fail("INTERNAL", error.message, 500);
  const list = (rows ?? []) as { id: string; org_id: string; profile_id: string; status: string; invited_by: string | null; created_at: string }[];
  if (list.length === 0) return ok({ affiliations: [] });

  const profileIds = [...new Set(list.map((r) => r.profile_id))];
  const profileClient = serviceKey ? createClient(supabaseUrl, serviceKey) : supabase;
  const { data: profiles } = await profileClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", profileIds);
  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }) => [
      p.id,
      { username: p.username ?? null, display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null },
    ])
  );
  const affiliations = list.map((r) => ({
    ...r,
    profile: profileMap.get(r.profile_id) ?? null,
  }));
  return ok({ affiliations });
}
