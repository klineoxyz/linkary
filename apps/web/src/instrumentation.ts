/**
 * Next.js instrumentation: runs once when the Node server starts.
 * Used to validate server env so production fails fast with a clear error.
 */
import { validateServerEnv } from "@/lib/env.server";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    validateServerEnv();
  }
}
