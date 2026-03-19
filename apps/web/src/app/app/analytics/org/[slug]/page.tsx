import { redirect } from "next/navigation";

/**
 * Legacy / mistaken URL: /app/analytics/org/{slug} was never a real analytics route.
 * Org X analytics live on the org workspace (stored snapshots) under Insights.
 */
export default async function OrgAnalyticsRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const raw = decodeURIComponent(String(slug ?? "").trim());
  if (!raw) redirect("/app/analytics");
  redirect(`/org/${encodeURIComponent(raw)}?tab=insights`);
}
