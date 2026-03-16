export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--crm-primary)]">Workspace: {slug}</h1>
      <p className="text-sm text-[var(--crm-muted)]">
        Workspace home and switcher (M1).
      </p>
    </div>
  );
}
