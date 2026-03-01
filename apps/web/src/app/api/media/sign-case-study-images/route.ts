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
import { rateLimit } from "@/lib/rate-limit";

const MAX_PATHS = 20;
const RATE_LIMIT_KEY_PREFIX = "sign-case-study-images";
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60;

function getToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const token = getToken(request);
  if (!token) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body != null && typeof body === "object" && "paths" in body) {
    const pathsVal = (body as { paths?: unknown }).paths;
    if (!Array.isArray(pathsVal) || !pathsVal.every((p): p is string => typeof p === "string")) {
      return NextResponse.json({ error: "paths must be an array of strings" }, { status: 400 });
    }
  }

  const raw = Array.isArray((body as { paths?: string[] })?.paths) ? (body as { paths: string[] }).paths : [];
  const paths = raw
    .filter((p): p is string => typeof p === "string" && p.trim() !== "" && !p.includes(".."))
    .map((p) => p.trim())
    .slice(0, MAX_PATHS);

  const serviceSupabase = createServiceSupabase();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (supabaseServiceKey) {
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const rl = await rateLimit({
      key: `${RATE_LIMIT_KEY_PREFIX}:${user.id}`,
      limit: RATE_LIMIT,
      windowSeconds: RATE_WINDOW_SECONDS,
      supabaseAdmin: service,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
  }

  if (paths.length === 0) {
    return NextResponse.json(
      { urlsByPath: {} },
      {
        headers: {
          "Cache-Control": "private, no-store",
          Pragma: "no-cache",
        },
      }
    );
  }

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
