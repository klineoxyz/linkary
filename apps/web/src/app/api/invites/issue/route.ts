/**
 * POST /api/invites/issue — issue one or more invite codes.
 * Body: { count?: number } (default 1).
 * Uses batches allocated to the caller (profile or org). Enforces lifetime cap 500 for non-admin.
 * Admin (@muazxinthi) can issue without cap. Sets issued_by_profile_id for lineage.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_TWITTER = "muazxinthi";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  let body: { count?: number };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const count = Math.min(Math.max(Number(body?.count) || 1, 1), 50);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, twitter_username")
    .eq("id", user.id)
    .maybeSingle();
  const twitter = ((profile as { twitter_username?: string | null })?.twitter_username ?? "")
    .replace(/^@/, "")
    .toLowerCase();
  const isAdmin = twitter === ADMIN_TWITTER;

  if (!isAdmin) {
    const LIFETIME_CAP = 500;
    const { count: issuedCount } = await supabase
      .from("invite_codes")
      .select("id", { count: "exact", head: true })
      .eq("issued_by_type", "profile")
      .eq("issued_by_id", user.id);
    if ((issuedCount ?? 0) >= LIFETIME_CAP) {
      return fail(`Lifetime invite cap (${LIFETIME_CAP}) reached`, 400);
    }
    const { data: batches } = await supabase
      .from("invite_batches")
      .select("id, count")
      .eq("allocated_to_type", "profile")
      .eq("allocated_to_id", user.id);
    let totalCapacity = 0;
    const batchIds = (batches ?? []).map((b: { id: string; count: number }) => {
      totalCapacity += b.count;
      return b.id;
    });
    if (batchIds.length === 0) return fail("No invite batch allocated to you", 400);
    const { data: codesInBatches } = await supabase
      .from("invite_codes")
      .select("batch_id")
      .in("batch_id", batchIds);
    const usedPerBatch: Record<string, number> = {};
    for (const c of codesInBatches ?? []) {
      const bid = (c as { batch_id: string | null }).batch_id;
      if (bid) usedPerBatch[bid] = (usedPerBatch[bid] ?? 0) + 1;
    }
    let totalUsed = 0;
    for (const b of batches ?? []) {
      const used = usedPerBatch[b.id] ?? 0;
      totalUsed += Math.min(used, b.count);
    }
    const remaining = totalCapacity - totalUsed;
    if (count > remaining) return fail(`Only ${remaining} invite(s) remaining in your batches`, 400);
  }

  const codes: { id: string; code: string; status: string }[] = [];
  for (let i = 0; i < count; i++) {
    let batchId: string | null = null;
    if (!isAdmin) {
      const { data: batches2 } = await supabase
        .from("invite_batches")
        .select("id, count")
        .eq("allocated_to_type", "profile")
        .eq("allocated_to_id", user.id);
      for (const b of batches2 ?? []) {
        const { count: used } = await supabase
          .from("invite_codes")
          .select("id", { count: "exact", head: true })
          .eq("batch_id", b.id);
        if ((used ?? 0) < b.count) {
          batchId = b.id;
          break;
        }
      }
    }
    let codeStr = generateCode();
    let exists = true;
    while (exists) {
      const { data: existing } = await supabase.from("invite_codes").select("id").eq("code", codeStr).maybeSingle();
      exists = !!existing;
      if (exists) codeStr = generateCode();
    }
    const { data: row, error: insertErr } = await supabase
      .from("invite_codes")
      .insert({
        code: codeStr,
        batch_id: batchId,
        issued_by_type: "profile",
        issued_by_id: user.id,
        issued_by_profile_id: user.id,
        status: "available",
      })
      .select("id, code, status")
      .single();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    codes.push(row as { id: string; code: string; status: string });
  }
  return NextResponse.json({ codes });
}
