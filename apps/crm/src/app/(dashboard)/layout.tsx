import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { getOpsMembershipRole } from "@/lib/internalOps";
import { DashboardShell } from "@/components/DashboardShell";
import { SetupRequired } from "@/components/SetupRequired";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return <SetupRequired />;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const service = createServiceSupabase();
  const opsRole = service ? await getOpsMembershipRole(service, session.user.id) : null;

  return (
    <DashboardShell user={session.user} opsRole={opsRole}>
      {children}
    </DashboardShell>
  );
}
