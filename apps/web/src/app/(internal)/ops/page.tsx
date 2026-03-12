"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OpsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/ops/check`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (body?.allowed) {
        setAllowed(true);
        if (token) {
          const qRes = await fetch(`${base}/api/admin/queue-status`, { headers: { Authorization: `Bearer ${token}` } });
          setIsSuperadmin(qRes.ok);
        }
      } else {
        setAllowed(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (allowed === false) {
      router.replace("/login");
    }
  }, [allowed, router]);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FB] p-6">
        <p className="text-zinc-600">Checking access…</p>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  const base = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-[#F7F8FB] text-gray-900 p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Ops: Readiness &amp; QA</h1>
      <ul className="list-disc list-inside space-y-2 text-sm text-zinc-700">
        <li>
          <strong>Readiness:</strong>{" "}
          <a href={`${base}/api/readiness`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            /api/readiness
          </a>
          {" "}(open in new tab or curl)
        </li>
        {isSuperadmin && (
          <li>
            <strong>Queue status:</strong>{" "}
            <a href={`${base}/api/admin/queue-status`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              /api/admin/queue-status
            </a>
            {" "}(requires Bearer token in browser; use curl with your JWT)
          </li>
        )}
      </ul>
      <h2 className="text-lg font-medium mt-6 mb-2">Quick checks</h2>
      <ul className="list-disc list-inside space-y-1 text-sm text-zinc-700">
        <li><strong>Brochure mode:</strong> Open any public profile and add <code className="bg-zinc-200 px-1 rounded">?view=brochure</code> to the URL. Layout should hide nav and sticky CTA; &quot;Copy brochure link&quot; should copy the full URL with <code className="bg-zinc-200 px-1 rounded">?view=brochure</code>.</li>
        <li><strong>Owner preview:</strong> Log in as the profile owner and open their public page. You should see instant updates (no cache); &quot;Refresh now&quot; fetches the owner-only DTO.</li>
      </ul>
      <p className="mt-6 text-xs text-zinc-500">
        See <code>docs/OPS_RUNBOOK_V1.md</code> in the repo for required env vars and runbook.
      </p>
    </div>
  );
}
