/**
 * GET /api/invites/admin-codes — admin only. List invite codes with breakdown, filter, search.
 * Query: status=available|redeemed|revoked|expired, search=substring, limit=number.
 * Returns: summary counts, codes array with allocated_to label, redeemed_by username, issued_by.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? null;
const ADMIN_TWITTER = "muazxinthi";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("twitter_username")
    .eq("id", user.id)
    .maybeSingle();
  const twitter = ((profile as { twitter_username?: string | null })?.twitter_username ?? "")
    .replace(/^@/, "")
    .toLowerCase();
  if (twitter !== ADMIN_TWITTER) return fail("Forbidden", 403);

  if (!serviceKey) return fail("Service unavailable", 503);
  const service = createClient(supabaseUrl, serviceKey);

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") ?? "";
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 200, 1), 500);

  const statuses = ["available", "redeemed", "revoked", "expired", "reserved"];

  const counts: Record<string, number> = { available: 0, redeemed: 0, revoked: 0, expired: 0, reserved: 0 };
  for (const status of statuses) {
    const { count } = await service.from("invite_codes").select("id", { count: "exact", head: true }).eq("status", status);
    counts[status] = count ?? 0;
  }

  let query = service
    .from("invite_codes")
    .select("id, code, status, batch_id, issued_by_type, issued_by_id, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (statusFilter && statuses.includes(statusFilter)) query = query.eq("status", statusFilter);
  if (search) query = query.ilike("code", `%${search}%`);
  const { data: codes, error: codesError } = await query;
  if (codesError) return NextResponse.json({ error: codesError.message }, { status: 500 });
  const codeList = codes ?? [];

  const batchIds = [...new Set(codeList.map((c: { batch_id: string | null }) => c.batch_id).filter(Boolean))];
  const { data: batches } = batchIds.length
    ? await service.from("invite_batches").select("id, allocated_to_type, allocated_to_id").in("id", batchIds)
    : { data: [] };
  const batchMap = new Map((batches ?? []).map((b: { id: string; allocated_to_type: string; allocated_to_id: string }) => [b.id, b]));

  const codeIds = codeList.map((c: { id: string }) => c.id);
  const { data: redemptions } = codeIds.length
    ? await service.from("invite_redemptions").select("invite_code_id, redeemer_profile_id").in("invite_code_id", codeIds)
    : { data: [] };
  const redemptionByCode = new Map<string, string>();
  for (const r of redemptions ?? []) {
    const row = r as { invite_code_id: string; redeemer_profile_id: string };
    redemptionByCode.set(row.invite_code_id, row.redeemer_profile_id);
  }

  const profileIds = new Set<string>();
  const orgIds = new Set<string>();
  for (const c of codeList) {
    const batch = batchMap.get((c as { batch_id: string | null }).batch_id ?? "");
    if (batch) {
      if (batch.allocated_to_type === "profile") profileIds.add(batch.allocated_to_id);
      else orgIds.add(batch.allocated_to_id);
    }
    if ((c as { issued_by_type: string }).issued_by_type === "profile") profileIds.add((c as { issued_by_id: string }).issued_by_id);
    else orgIds.add((c as { issued_by_id: string }).issued_by_id);
    const redeemerId = redemptionByCode.get((c as { id: string }).id);
    if (redeemerId) profileIds.add(redeemerId);
  }
  const { data: profiles } = profileIds.size
    ? await service.from("profiles").select("id, username").in("id", [...profileIds])
    : { data: [] };
  const { data: orgs } = orgIds.size
    ? await service.from("orgs").select("id, name").in("id", [...orgIds])
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p: { id: string; username: string | null }) => [p.id, p.username ?? p.id]));
  const orgMap = new Map((orgs ?? []).map((o: { id: string; name: string | null }) => [o.id, o.name ?? o.id]));

  const list = codeList.map((c: Record<string, unknown>) => {
    const batch = batchMap.get((c.batch_id as string) ?? "");
    const allocatedToType = batch?.allocated_to_type ?? "";
    const allocatedToId = batch?.allocated_to_id ?? "";
    const allocatedToLabel =
      allocatedToType === "profile"
        ? profileMap.get(allocatedToId) ?? allocatedToId
        : allocatedToType === "org"
          ? orgMap.get(allocatedToId) ?? allocatedToId
          : "";
    const issuedByLabel =
      (c.issued_by_type as string) === "profile"
        ? profileMap.get((c.issued_by_id as string) ?? "") ?? (c.issued_by_id as string)
        : orgMap.get((c.issued_by_id as string) ?? "") ?? (c.issued_by_id as string);
    const redeemerId = redemptionByCode.get((c.id as string) ?? "");
    const redeemedByUsername = redeemerId ? profileMap.get(redeemerId) ?? redeemerId : null;
    return {
      id: c.id,
      code: c.code,
      status: c.status,
      created_at: c.created_at,
      expires_at: c.expires_at,
      batch_allocated_to_type: allocatedToType,
      batch_allocated_to_id: allocatedToId,
      batch_allocated_to_label: allocatedToLabel,
      issued_by_type: c.issued_by_type,
      issued_by_id: c.issued_by_id,
      issued_by_label: issuedByLabel,
      redeemed_by_profile_id: redeemerId || null,
      redeemed_by_username: redeemedByUsername,
    };
  });

  return NextResponse.json({
    summary: counts,
    codes: list,
  });
}
