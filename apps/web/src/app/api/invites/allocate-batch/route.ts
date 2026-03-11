/**
 * POST /api/invites/allocate-batch — admin only. Allocate invite capacity to a profile or org.
 * Body: { allocated_to_type: 'profile'|'org', allocated_to_id: uuid, count: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_TWITTER = "muazxinthi";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("twitter_username")
    .eq("id", user.id)
    .maybeSingle();
  const twitter = ((profile as { twitter_username?: string | null })?.twitter_username ?? "")
    .replace(/^@/, "")
    .toLowerCase();
  if (twitter !== ADMIN_TWITTER) return fail("Forbidden", 403);

  let body: { allocated_to_type?: string; allocated_to_id?: string; count?: number };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const type = body?.allocated_to_type === "org" ? "org" : "profile";
  const id = typeof body?.allocated_to_id === "string" ? body.allocated_to_id.trim() : "";
  const count = Math.min(Math.max(Number(body?.count) || 1, 1), 1000);
  if (!id) return fail("allocated_to_id required", 400);

  const { data: row, error } = await supabase
    .from("invite_batches")
    .insert({
      allocated_to_type: type,
      allocated_to_id: id,
      count,
      allocated_by: user.id,
    })
    .select("id, allocated_to_type, allocated_to_id, count, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch: row });
}
