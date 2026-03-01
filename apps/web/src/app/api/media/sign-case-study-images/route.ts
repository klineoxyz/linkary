/**
 * POST /api/media/sign-case-study-images
 * Returns signed URLs for case study proof images. Owner-only: only paths that belong to
 * the requesting user's case studies (owner_profile_id = user.id) are signed.
 * Service role is used only on the server; client never sees it.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { createSignedUrlForPath } from "@/lib/mediaSignedUrlServer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MAX_PATHS = 20;

function getToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export async function POST(request: NextRequest) {
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

  let body: { paths?: string[] } | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = Array.isArray(body?.paths) ? body.paths : [];
  const paths = raw
    .filter((p): p is string => typeof p === "string" && p.trim() !== "" && !p.includes(".."))
    .map((p) => p.trim())
    .slice(0, MAX_PATHS);

  if (paths.length === 0) {
    return NextResponse.json({ urlsByPath: {} });
  }

  const serviceSupabase = createServiceSupabase();
  const { data: rows, error: dbError } = await serviceSupabase
    .from("case_studies")
    .select("proof_file_path")
    .eq("owner_type", "profile")
    .eq("owner_profile_id", user.id)
    .in("proof_file_path", paths);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const allowedPaths = new Set(
    (rows ?? [])
      .map((r) => (r as { proof_file_path: string | null }).proof_file_path?.trim())
      .filter((p): p is string => !!p && paths.includes(p))
  );

  const urlsByPath: Record<string, string | null> = {};
  for (const path of paths) {
    if (!allowedPaths.has(path)) {
      urlsByPath[path] = null;
      continue;
    }
    const signed = await createSignedUrlForPath(serviceSupabase, path);
    urlsByPath[path] = signed ?? null;
  }

  return NextResponse.json(
    { urlsByPath },
    {
      headers: {
        "Cache-Control": "private, no-store",
        Pragma: "no-cache",
      },
    }
  );
}
