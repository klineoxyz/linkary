/**
 * GET: List my profile links (ordered).
 * POST: Create a profile link.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TITLE_MIN = 1;
const TITLE_MAX = 60;
const ICON_MAX = 32;

function isValidUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("https://") || t.startsWith("http://");
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  const profileId = getProfileIdForAuthUser(user.id);

  const { data: rows, error } = await supabase
    .from("profile_links")
    .select("id, title, url, icon, is_public, sort_order, created_at, updated_at")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ links: rows ?? [] });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  const profileId = getProfileIdForAuthUser(user.id);

  let body: { title?: string; url?: string; icon?: string | null; is_public?: boolean };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return fail("BAD_REQUEST", `Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters`, 400);
  }
  if (!isValidUrl(url)) {
    return fail("BAD_REQUEST", "URL must start with https:// or http://", 400);
  }
  const icon = typeof body?.icon === "string" ? body.icon.trim().slice(0, ICON_MAX) || null : null;
  const is_public = typeof body?.is_public === "boolean" ? body.is_public : true;

  const { data: maxOrder } = await supabase
    .from("profile_links")
    .select("sort_order")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxOrder as { sort_order?: number } | null)?.sort_order ?? -1;
  const nextSortOrder = sort_order + 1;

  const { data: row, error } = await supabase
    .from("profile_links")
    .insert({
      profile_id: profileId,
      title,
      url,
      icon,
      is_public,
      sort_order: nextSortOrder,
    })
    .select("id, title, url, icon, is_public, sort_order, created_at, updated_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ link: row });
}
