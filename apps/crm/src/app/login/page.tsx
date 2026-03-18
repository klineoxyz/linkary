import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";
import { SetupRequired } from "@/components/SetupRequired";

export default async function LoginPage() {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return <SetupRequired />;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--crm-page-bg)] p-4 sm:p-6">
      <div className="crm-surface-raised w-full max-w-[22rem] p-6 sm:p-8">
        <h1 className="text-xl font-bold tracking-tight text-[var(--crm-foreground)] mb-1">
          <span className="text-[var(--crm-primary)]">Linkary</span>
          <span className="text-[var(--crm-muted)] font-semibold"> CRM</span>
        </h1>
        <p className="text-xs uppercase tracking-wider text-[var(--crm-muted)] mb-4">Delivery workspace</p>
        <p className="text-sm text-[var(--crm-muted)] mb-6 leading-relaxed">
          Use the same email as <span className="text-[var(--crm-foreground)] font-medium">linkary.xyz</span>.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
