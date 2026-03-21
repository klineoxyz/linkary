import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { SetupRequired } from "@/components/SetupRequired";
import { userHasOpsMembership } from "@/lib/opsAccess";

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

  const showOpsNav = await userHasOpsMembership(session.user.id);

  return (
    <DashboardShell user={session.user} showOpsNav={showOpsNav}>
      {children}
    </DashboardShell>
  );
}
