/**
 * POST /api/media/remove
 * Body: { type, owner_id } — clears file_path in DB and removes object from storage.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = "media";

const MEDIA_TYPES = ["profile_header", "org_logo", "partner_logo", "case_study_proof"] as const;

function getToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export async function POST(request: Request) {
  const token = getToken(request);
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { type?: string; owner_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const type = body?.type;
  const owner_id = typeof body?.owner_id === "string" ? body.owner_id.trim() : "";
  if (!type || !MEDIA_TYPES.includes(type as (typeof MEDIA_TYPES)[number]) || !owner_id) {
    return NextResponse.json({ error: "type and owner_id required" }, { status: 400 });
  }

  if (type === "profile_header") {
    if (owner_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (type === "org_logo") {
    const { data: member } = await supabase.from("org_members").select("org_id").eq("org_id", owner_id).eq("user_id", user.id).maybeSingle();
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (type === "partner_logo") {
    const { data: row } = await supabase.from("partner_programs").select("id, owner_type, owner_id").eq("id", owner_id).maybeSingle();
    const r = row as { owner_type?: string; owner_id?: string } | null;
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (r.owner_type === "profile" && r.owner_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (r.owner_type === "org") {
      const { data: member } = await supabase.from("org_members").select("org_id").eq("org_id", r.owner_id).eq("user_id", user.id).maybeSingle();
      if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (type === "case_study_proof") {
    const { data: row } = await supabase.from("case_studies").select("id, owner_type, owner_profile_id, owner_org_id").eq("id", owner_id).maybeSingle();
    const r = row as { owner_type?: string; owner_profile_id?: string; owner_org_id?: string } | null;
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (r.owner_type === "profile" && r.owner_profile_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (r.owner_type === "org") {
      const { data: member } = await supabase.from("org_members").select("org_id").eq("org_id", r.owner_org_id).eq("user_id", user.id).maybeSingle();
      if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let file_path: string | null = null;
  if (type === "profile_header") {
    const { data: row } = await supabase.from("profile_media").select("header_media_file_path").eq("profile_id", owner_id).maybeSingle();
    file_path = (row as { header_media_file_path?: string } | null)?.header_media_file_path ?? null;
    if (file_path) await supabase.storage.from(BUCKET).remove([file_path]);
    await supabase.from("profile_media").upsert({ profile_id: owner_id, header_media_type: "NONE", header_media_file_path: null, header_media_url: null, updated_at: new Date().toISOString() }, { onConflict: "profile_id" });
  } else if (type === "org_logo") {
    const { data: row } = await supabase.from("orgs").select("logo_file_path").eq("id", owner_id).maybeSingle();
    file_path = (row as { logo_file_path?: string } | null)?.logo_file_path ?? null;
    if (file_path) await supabase.storage.from(BUCKET).remove([file_path]);
    await supabase.from("orgs").update({ logo_file_path: null, updated_at: new Date().toISOString() }).eq("id", owner_id);
  } else if (type === "partner_logo") {
    const { data: row } = await supabase.from("partner_programs").select("logo_file_path").eq("id", owner_id).maybeSingle();
    file_path = (row as { logo_file_path?: string } | null)?.logo_file_path ?? null;
    if (file_path) await supabase.storage.from(BUCKET).remove([file_path]);
    await supabase.from("partner_programs").update({ logo_file_path: null }).eq("id", owner_id);
  } else {
    const { data: row } = await supabase.from("case_studies").select("proof_file_path").eq("id", owner_id).maybeSingle();
    file_path = (row as { proof_file_path?: string } | null)?.proof_file_path ?? null;
    if (file_path) await supabase.storage.from(BUCKET).remove([file_path]);
    await supabase.from("case_studies").update({ proof_file_path: null }).eq("id", owner_id);
  }

  return NextResponse.json({ ok: true });
}
