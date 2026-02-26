/**
 * POST /api/media/commit
 * Body: { type, owner_id, file_path [, file_name ] }
 * Stores file_path in the correct table (profile_media, orgs, partner_programs, case_studies).
 * Validates path prefix matches type and owner_id; removes old object from storage when replacing.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = "media";

const MEDIA_TYPES = ["profile_header", "profile_hero", "org_logo", "partner_logo", "case_study_proof"] as const;

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

  let body: { type?: string; owner_id?: string; file_path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const type = body?.type;
  const owner_id = typeof body?.owner_id === "string" ? body.owner_id.trim() : "";
  const file_path = typeof body?.file_path === "string" ? body.file_path.trim() : "";
  if (!type || !MEDIA_TYPES.includes(type as (typeof MEDIA_TYPES)[number]) || !owner_id || !file_path) {
    return NextResponse.json({ error: "type, owner_id, file_path required" }, { status: 400 });
  }

  const expectedPrefix =
    type === "profile_header"
      ? `profile/${owner_id}/header/`
      : type === "profile_hero"
        ? `profile/${owner_id}/hero/`
        : type === "org_logo"
          ? `org/${owner_id}/logo/`
          : type === "partner_logo"
            ? `partner/${owner_id}/logo/`
            : `case_study/${owner_id}/proof/`;
  if (!file_path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid file_path for type/owner" }, { status: 400 });
  }

  // Authz same as upload-url
  if (type === "profile_header" || type === "profile_hero") {
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

  if (type === "profile_header") {
    const { data: existing } = await supabase.from("profile_media").select("header_media_file_path").eq("profile_id", owner_id).maybeSingle();
    const oldPath = (existing as { header_media_file_path?: string } | null)?.header_media_file_path;
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
    await supabase.from("profile_media").upsert(
      { profile_id: owner_id, header_media_type: "IMAGE", header_media_file_path: file_path, header_media_url: null, updated_at: new Date().toISOString() },
      { onConflict: "profile_id" }
    );
  } else if (type === "profile_hero") {
    const { data: existing } = await supabase.from("profiles").select("hero_image_url").eq("id", owner_id).maybeSingle();
    const oldPath = (existing as { hero_image_url?: string } | null)?.hero_image_url;
    if (oldPath && oldPath.startsWith("profile/")) await supabase.storage.from(BUCKET).remove([oldPath]);
    await supabase.from("profiles").update({ hero_image_url: file_path, hero_video_url: null, updated_at: new Date().toISOString() }).eq("id", owner_id);
  } else if (type === "org_logo") {
    const { data: existing } = await supabase.from("orgs").select("logo_file_path").eq("id", owner_id).maybeSingle();
    const oldPath = (existing as { logo_file_path?: string } | null)?.logo_file_path;
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
    await supabase.from("orgs").update({ logo_file_path: file_path, updated_at: new Date().toISOString() }).eq("id", owner_id);
  } else if (type === "partner_logo") {
    const { data: existing } = await supabase.from("partner_programs").select("logo_file_path").eq("id", owner_id).maybeSingle();
    const oldPath = (existing as { logo_file_path?: string } | null)?.logo_file_path;
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
    await supabase.from("partner_programs").update({ logo_file_path: file_path }).eq("id", owner_id);
  } else {
    const { data: existing } = await supabase.from("case_studies").select("proof_file_path").eq("id", owner_id).maybeSingle();
    const oldPath = (existing as { proof_file_path?: string } | null)?.proof_file_path;
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
    await supabase.from("case_studies").update({ proof_file_path: file_path }).eq("id", owner_id);
  }

  return NextResponse.json({ ok: true, file_path });
}
