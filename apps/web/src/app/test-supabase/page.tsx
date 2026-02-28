import { notFound } from "next/navigation";
import TestSupabaseClient from "./TestSupabaseClient";

export const dynamic = "force-dynamic";

/** Lock in production: do not expose test route. */
export default function TestSupabasePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <TestSupabaseClient />;
}
