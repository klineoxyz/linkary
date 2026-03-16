export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--crm-primary)]">Campaign {id}</h1>
      <p className="text-sm text-[var(--crm-muted)]">
        Campaign detail: performance, submissions, contributors, export (M4/M7).
      </p>
    </div>
  );
}
