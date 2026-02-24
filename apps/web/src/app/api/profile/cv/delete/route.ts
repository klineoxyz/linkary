/**
 * POST /api/profile/cv/delete
 * Removes current CV from storage and profile_documents; clears profiles.cv_document_id.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = "profile-documents";

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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("cv_document_id")
    .eq("id", user.id)
    .maybeSingle();
  const docId = (profile as { cv_document_id?: string } | null)?.cv_document_id;
  if (!docId) {
    return NextResponse.json({ ok: true, message: "No CV to delete" });
  }

  const { data: doc } = await supabase
    .from("profile_documents")
    .select("file_path")
    .eq("id", docId)
    .eq("profile_id", user.id)
    .maybeSingle();
  const file_path = (doc as { file_path?: string } | null)?.file_path;
  if (file_path) {
    await supabase.storage.from(BUCKET).remove([file_path]);
  }

  await supabase.from("profile_documents").delete().eq("id", docId).eq("profile_id", user.id);
  await supabase.from("profiles").update({ cv_document_id: null }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
