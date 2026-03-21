import { NextResponse } from "next/server";
import { runExternalXProfileSearch } from "@/lib/externalXSearchService";
import { isUserMemberOfOrgLinkedWorkspace } from "@/lib/orgWorkspaceAccess";
import { isUuid } from "@/lib/opsWritesValidation";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

function twitterApiKeyFromEnv(): string | null {
  const k =
    process.env.TWITTERAPI_API_KEY ??
    process.env.TWITTERAPI_IO_KEY ??
    process.env.TWITTERAPI_KEY ??
    process.env.TWITTERAPI_TOKEN;
  const t = typeof k === "string" ? k.trim() : "";
  return t.length > 0 ? t : null;
}

/**
 * POST /api/org/external-x-search
 * Body: { org_id: uuid, handle: string }
 * Org workspace members only; org plan StartUP / UniCorn / Custom; monthly hard cap; global handle cache.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false as const, code: "SETUP_REQUIRED", message: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false as const, code: "UNAUTHORIZED", message: "Sign in required" }, { status: 401 });
  }

  const service = createServiceSupabase();
  if (!service) {
    return NextResponse.json({ ok: false as const, code: "SERVICE_ROLE_MISSING", message: "Service role not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false as const, code: "BAD_JSON", message: "Invalid JSON" }, { status: 400 });
  }

  const orgRaw = body.org_id;
  const handleRaw = body.handle;
  if (typeof orgRaw !== "string" || !isUuid(orgRaw)) {
    return NextResponse.json({ ok: false as const, code: "INVALID_ORG", message: "org_id UUID required" }, { status: 400 });
  }
  if (typeof handleRaw !== "string" || !handleRaw.trim()) {
    return NextResponse.json({ ok: false as const, code: "INVALID_HANDLE", message: "handle required" }, { status: 400 });
  }

  const orgId = orgRaw.trim().toLowerCase();

  const allowed = await isUserMemberOfOrgLinkedWorkspace(service, session.user.id, orgId);
  if (!allowed) {
    return NextResponse.json(
      {
        ok: false as const,
        code: "ORG_WORKSPACE_ACCESS_DENIED",
        message: "You must be a member of the CRM workspace linked to this org.",
      },
      { status: 403 }
    );
  }

  const twitterApiKey = twitterApiKeyFromEnv();
  if (!twitterApiKey) {
    return NextResponse.json(
      { ok: false as const, code: "TWITTERAPI_KEY_MISSING", message: "TWITTERAPI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const result = await runExternalXProfileSearch({
    service,
    orgId,
    handleRaw,
    twitterApiKey,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false as const,
        code: result.code,
        message: result.message,
        ...(result.usage ? { usage: result.usage } : {}),
      },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true as const,
    source: result.source,
    handle_normalized: result.handle_normalized,
    profile: result.profile,
    ...(result.usage ? { usage: result.usage } : {}),
  });
}
