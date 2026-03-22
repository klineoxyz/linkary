import { assertOpsPageAccess } from "@/lib/opsAccess";
import { OpsSectionTabs } from "@/components/OpsSectionTabs";

export default async function OpsAreaLayout({ children }: { children: React.ReactNode }) {
  const { role } = await assertOpsPageAccess();

  return (
    <div className="space-y-6">
      <OpsSectionTabs role={role} />
      {children}
    </div>
  );
}
