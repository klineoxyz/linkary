import { notFound, permanentRedirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveOrgBySegment } from "@/lib/resolveOrgServer";
import OrgPageClient from "./OrgPageClient";
import type { Org } from "@/lib/orgs";

type OrgPageProps = {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeSegment(segment: string): string {
  return decodeURIComponent(segment ?? "").trim().toLowerCase().replace(/^@/, "");
}

function buildQueryString(searchParams: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") qs.set(key, value);
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function OrgPage({ params, searchParams }: OrgPageProps) {
  const { orgId: segment } = await params;
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  if (!supabase) notFound();

  const resolved = await resolveOrgBySegment(segment ?? "", supabase);
  if (!resolved) notFound();

  const incoming = normalizeSegment(segment ?? "");
  const canonical = normalizeSegment(resolved.slug ?? "");
  if (incoming && canonical && incoming !== canonical) {
    const query = buildQueryString(sp);
    permanentRedirect(`/org/${encodeURIComponent(resolved.slug)}${query}`);
  }

  const { data: fullRow } = await supabase.from("orgs").select("*").eq("id", resolved.id).maybeSingle();
  /** If select("*") returns null (edge RLS/cache), still pass minimal row so client never loses the org. */
  const initialOrgSnapshot =
    (fullRow as Org | null) ??
    ({
      id: resolved.id,
      slug: resolved.slug ?? "",
      name: resolved.name ?? "",
      tagline: null,
      website: null,
      twitter_username: null,
      logo_url: null,
      org_type: "project",
      parent_org_id: null,
      created_by: null,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    } as Org);

  return <OrgPageClient initialOrgId={resolved.id} initialOrgSnapshot={initialOrgSnapshot} />;
}
