import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveOrgBySegment } from "@/lib/resolveOrgServer";
import OrgPageClient from "./OrgPageClient";

export default async function OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId: segment } = await params;
  const supabase = await createServerSupabase();
  if (!supabase) notFound();

  const org = await resolveOrgBySegment(segment ?? "", supabase);
  if (!org) notFound();

  return <OrgPageClient initialOrgId={org.id} />;
}
