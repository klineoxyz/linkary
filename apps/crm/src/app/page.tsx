import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  // TODO: resolve default workspace (creator vs org) and redirect to /tasks or /campaigns
  redirect("/tasks");
}
