import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/** POST: body { file_path, file_name?, size_bytes? }. Inserts profile_documents and sets profiles.cv_document_id */
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
  let body: { file_path?: string; file_name?: string; size_bytes?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const file_path = typeof body.file_path === "string" ? body.file_path.trim() : "";
  if (!file_path || !file_path.startsWith(`profiles/${user.id}/cv/`)) {
    return NextResponse.json({ error: "Invalid file_path" }, { status: 400 });
  }
  const file_name = typeof body.file_name === "string" ? body.file_name.slice(0, 255) : null;
  const size_bytes = typeof body.size_bytes === "number" && body.size_bytes >= 0 ? body.size_bytes : null;
  const { data: doc, error: insertErr } = await supabase
    .from("profile_documents")
    .insert({
      profile_id: user.id,
      doc_type: "cv",
      file_path,
      file_name,
      mime_type: "application/pdf",
      size_bytes,
    })
    .select("id")
    .single();
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  await supabase.from("profiles").update({ cv_document_id: (doc as { id: string }).id }).eq("id", user.id);
  return NextResponse.json({ ok: true, document_id: (doc as { id: string }).id });
}
