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
    <div className="min-h-screen flex items-center justify-center bg-[var(--crm-bg)] p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--crm-foreground)] mb-2">
          <span className="text-[var(--crm-primary)]">Linkary</span> CRM
        </h1>
        <p className="text-sm text-[var(--crm-muted)] mb-6">
          Sign in with your Linkary account (same as linkary.xyz).
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
