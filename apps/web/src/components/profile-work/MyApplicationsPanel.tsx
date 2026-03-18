"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ApplicationRow = {
  id: string;
  gig_id: string;
  message: string | null;
  status: string;
  created_at: string;
  gig: {
    id: string;
    title: string;
    status: string;
    owner: { username: string | null; display_name: string | null } | null;
  } | null;
};

export function MyApplicationsPanel({
  variant = "standalone",
}: {
  variant?: "standalone" | "embedded";
}) {
  const router = useRouter();
  const loginNext =
    variant === "embedded" ? "/app/profile/applications" : "/profile/applications";
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = (session as { access_token?: string } | null)?.access_token;
      if (!token) {
        if (!cancelled) {
          setApplications([]);
          router.replace(`/login?next=${encodeURIComponent(loginNext)}`);
        }
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      try {
        const res = await fetch(`${base}/api/applications/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (json.ok && Array.isArray(json.applications)) setApplications(json.applications as ApplicationRow[]);
          else setApplications([]);
          if (!res.ok) setError(json.message ?? "Failed to load");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router, loginNext]);

  return (
    <div className={variant === "standalone" ? "min-h-screen bg-background text-foreground" : ""}>
      <main className="mx-auto max-w-2xl px-3 sm:px-4 py-6 sm:py-8 min-w-0 break-words">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/app/profile"
            className="text-sm font-medium text-muted-foreground hover:text-primary"
          >
            ← My profile
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-foreground">My applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gigs you applied to on creator profiles. Job and program invites live under{" "}
          <Link href="/app/org-invites" className="text-primary hover:underline">Invites</Link>.
        </p>
        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-destructive">{error}</p>
        ) : applications.length === 0 ? (
          <p className="mt-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No gig applications yet. Browse profiles with open gigs and apply from their public page.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {applications.map((app) => (
              <li
                key={app.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {app.gig?.title ?? "Gig"}
                    </p>
                    {app.gig?.owner?.username && (
                      <Link
                        href={`/${encodeURIComponent(app.gig.owner.username)}`}
                        className="mt-0.5 text-sm text-primary hover:underline"
                      >
                        @{app.gig.owner.username}
                      </Link>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground capitalize">
                      Status: {app.status}
                    </p>
                    {app.message && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {app.message}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground capitalize">
                    {app.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
