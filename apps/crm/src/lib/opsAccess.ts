import { redirect, notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { getOpsMembershipRole, type OpsRole } from "@/lib/internalOps";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OpsSessionOk = {
  userId: string;
  role: OpsRole;
  service: SupabaseClient;
};

/**
 * Server Components under /ops: require session + active internal_ops_members row.
 * Non-ops → 404 (area hidden). Missing service key → 404.
 */
export async function assertOpsPageAccess(): Promise<OpsSessionOk> {
  const supabase = await createServerSupabase();
  if (!supabase) notFound();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) redirect("/login");

  const service = createServiceSupabase();
  if (!service) notFound();

  const role = await getOpsMembershipRole(service, session.user.id);
  if (!role) notFound();

  return { userId: session.user.id, role, service };
}

/**
 * Route handlers: 401 unauthenticated, 403 authenticated non-ops, 503 no service role.
 */
export async function requireOpsApiAccess(): Promise<OpsSessionOk | NextResponse> {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable", code: "SETUP_REQUIRED" }, { status: 503 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const service = createServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: "Service unavailable", code: "SERVICE_ROLE_MISSING" }, { status: 503 });
  }

  const role = await getOpsMembershipRole(service, session.user.id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden", code: "OPS_REQUIRED" }, { status: 403 });
  }

  return { userId: session.user.id, role, service };
}

/** For dashboard nav: show Ops link only when user has active ops membership. */
export async function userHasOpsMembership(userId: string): Promise<boolean> {
  const service = createServiceSupabase();
  if (!service) return false;
  const role = await getOpsMembershipRole(service, userId);
  return role != null;
}
