import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveOrgBySegment } from "@/lib/resolveOrgServer";
import OrgPageClient from "./OrgPageClient";
import type { Org } from "@/lib/orgs";

export default async function OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId: segment } = await params;
  const supabase = await createServerSupabase();
  if (!supabase) notFound();

  const resolved = await resolveOrgBySegment(segment ?? "", supabase);
  if (!resolved) notFound();

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
