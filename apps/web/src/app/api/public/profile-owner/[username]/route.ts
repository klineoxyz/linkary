/**
 * GET /api/public/profile-owner/[username]
 * Returns the same PublicPageDTO as the public profile route, but only for the owner.
 * Bearer required. Cache-Control: no-store so owner always sees latest after save.
 * Use this to hydrate the public page for the logged-in owner (instant preview).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPublicDTOForOwner } from "@/lib/getPublicDTO";
import { normalizeIdentifier } from "@/lib/entityResolver";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
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

  const { username: raw } = await context.params;
  const segment = (raw ?? "").trim();
  if (!segment) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);
  const norm = (normalizeIdentifier(segment) ?? segment.trim().toLowerCase().replace(/^@/, "")) || segment;
  const result = await getPublicDTOForOwner(norm, user.id, service);

  if (!result) {
    return NextResponse.json({ error: "Forbidden or not found" }, { status: 403 });
  }

  return NextResponse.json(result.dto, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Canonical-Username": result.canonicalUsername,
    },
  });
}
