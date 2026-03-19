import { notFound } from "next/navigation";
import AppWithProviders from "@/app/AppWithProviders";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveOrgBySegment } from "@/lib/resolveOrgServer";
import { OrgRouteProvider } from "@/lib/orgRouteContext";
import type { Org } from "@/lib/orgs";

/**
 * Backward-compatible org analytics URL.
 * Keeps /app/analytics/org/{slug} usable while loading the org workspace Insights tab.
 */
export default async function OrgAnalyticsRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const segment = decodeURIComponent(String(slug ?? "").trim());
  if (!segment) notFound();

  const supabase = await createServerSupabase();
  if (!supabase) notFound();

  const resolved = await resolveOrgBySegment(segment, supabase);
  if (!resolved) notFound();

  const { data: fullRow } = await supabase.from("orgs").select("*").eq("id", resolved.id).maybeSingle();
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

  return (
    <OrgRouteProvider initialOrgId={resolved.id} initialOrgSnapshot={initialOrgSnapshot}>
      <AppWithProviders />
    </OrgRouteProvider>
  );
}
