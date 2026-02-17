"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestSupabasePage() {
  const [status, setStatus] = useState<"loading" | "connected" | "failed">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function test() {
      try {
        await supabase.auth.getSession();
        setStatus("connected");
      } catch (err) {
        setStatus("failed");
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    test();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        {status === "loading" && <p>Testing connection…</p>}
        {status === "connected" && (
          <p className="text-green-600 font-medium">Supabase Connected</p>
        )}
        {status === "failed" && (
          <>
            <p className="text-red-600 font-medium">Connection Failed</p>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
