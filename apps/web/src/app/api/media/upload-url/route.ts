/**
 * POST /api/media/upload-url
 * Body: { type: 'profile_header'|'org_logo'|'partner_logo'|'case_study_proof', owner_id: string, file_name: string, content_type?: string }
 * Returns { uploadUrl, file_path }. Client PUTs file to uploadUrl then calls /api/media/commit.
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

function extFromName(fileName: string): string {
  const m = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "bin";
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

  let body: { type?: string; owner_id?: string; file_name?: string; content_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const type = body?.type;
  const owner_id = typeof body?.owner_id === "string" ? body.owner_id.trim() : "";
  const file_name = typeof body?.file_name === "string" ? body.file_name.trim().slice(0, 255) : "file";
  if (!type || !MEDIA_TYPES.includes(type as (typeof MEDIA_TYPES)[number]) || !owner_id) {
    return NextResponse.json({ error: "type and owner_id required" }, { status: 400 });
  }

  // Authz: user must be allowed to upload for this owner
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

  const uuid = crypto.randomUUID();
  const ext = extFromName(file_name);
  const filePath =
    type === "profile_header"
      ? `profile/${owner_id}/header/${uuid}.${ext}`
      : type === "profile_hero"
        ? `profile/${owner_id}/hero/${uuid}.${ext}`
        : type === "org_logo"
        ? `org/${owner_id}/logo/${uuid}.${ext}`
        : type === "partner_logo"
          ? `partner/${owner_id}/logo/${uuid}.${ext}`
          : `case_study/${owner_id}/proof/${uuid}.${ext}`;

  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(filePath);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ uploadUrl: signed.signedUrl, path: signed.path, file_path: filePath });
}
