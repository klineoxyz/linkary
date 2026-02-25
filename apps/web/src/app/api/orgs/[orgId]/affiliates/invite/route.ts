/**
 * POST: Invite a profile as affiliate by handle or profile_id. Notifies invitee (affiliate_invite).
 * Only creates notification when a new invite row is created or status transitions removed -> invited.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inviteAffiliate } from "@/lib/orgs";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const orgId = (await params).orgId;
  if (!orgId) return fail("BAD_REQUEST", "orgId required", 400);

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

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId, p_uid: user.id });
  if (!isAdmin) return fail("FORBIDDEN", "Only org owner or admin can invite affiliates", 403);

  let body: { profile_handle?: string; profile_id?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  let profileId: string | null = null;
  if (typeof body?.profile_id === "string" && body.profile_id.trim()) {
    profileId = body.profile_id.trim();
  } else if (typeof body?.profile_handle === "string" && body.profile_handle.trim()) {
    const handle = body.profile_handle.trim().replace(/^@/, "").toLowerCase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", handle)
      .maybeSingle();
    if (!profile) return fail("NOT_FOUND", "Profile not found for that handle", 404);
    profileId = (profile as { id: string }).id;
  }
  if (!profileId) return fail("BAD_REQUEST", "profile_handle or profile_id required", 400);

  // org_affiliations has UNIQUE(profile_id): one affiliation per profile globally
  const { data: existing } = await supabase
    .from("org_affiliations")
    .select("id, org_id, status")
    .eq("profile_id", profileId)
    .maybeSingle();
  const existingRow = existing as { id: string; org_id: string; status: string } | null;
  if (existingRow) {
    if (existingRow.org_id !== orgId) {
      return fail("CONFLICT", "Profile is already affiliated with another org", 409);
    }
    if (existingRow.status === "invited") {
      return NextResponse.json(ok({ alreadyInvited: true }));
    }
    if (existingRow.status === "removed") {
      const { error: updateErr } = await supabase
        .from("org_affiliations")
        .update({ status: "invited" })
        .eq("id", existingRow.id)
        .eq("org_id", orgId);
      if (updateErr) return fail("INTERNAL", updateErr.message, 500);
      if (serviceKey) {
        try {
          const { createNotification } = await import("@/lib/notifications");
          await createNotification(profileId, "affiliate_invite", {
            entity_type: "org",
            entity_id: orgId,
            payload: { org_id: orgId },
          });
        } catch (_) {
          /* non-blocking */
        }
      }
      return NextResponse.json(ok({ invited: true }));
    }
  }

  const { error: inviteErr } = await inviteAffiliate(orgId, profileId, user.id);
  if (inviteErr) {
    if (inviteErr.includes("duplicate") || inviteErr.includes("unique") || inviteErr.includes("already exists")) {
      return NextResponse.json(ok({ alreadyInvited: true }));
    }
    return fail("INTERNAL", inviteErr, 500);
  }

  if (serviceKey) {
    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification(profileId, "affiliate_invite", {
        entity_type: "org",
        entity_id: orgId,
        payload: { org_id: orgId },
      });
    } catch (_) {
      /* non-blocking */
    }
  }
  return NextResponse.json(ok({ invited: true }));
}
