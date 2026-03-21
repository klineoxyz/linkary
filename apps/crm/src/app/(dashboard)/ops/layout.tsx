import { assertOpsPageAccess } from "@/lib/opsAccess";
import { OpsSubNav } from "@/components/OpsSubNav";

export default async function OpsAreaLayout({ children }: { children: React.ReactNode }) {
  const { role } = await assertOpsPageAccess();

  return (
    <div className="space-y-6">
      <OpsSubNav role={role} />
      {children}
    </div>
  );
}
