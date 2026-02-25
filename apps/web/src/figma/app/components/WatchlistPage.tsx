"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { isPrivateStorageUrl } from "@/lib/isPrivateStorageUrl";
import { User, Building2 } from "lucide-react";

interface WatchlistPerson {
  entity_type: "profile";
  entity_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface WatchlistOrg {
  entity_type: "org";
  entity_id: string;
  slug: string | null;
  name: string | null;
  logo_url: string | null;
  created_at: string;
}

export default function WatchlistPage({
  setRoute,
}: {
  setRoute: (r: { name: string; data?: Record<string, unknown> }) => void;
}) {
  const [people, setPeople] = useState<WatchlistPerson[]>([]);
  const [orgs, setOrgs] = useState<WatchlistOrg[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setPeople([]);
      setOrgs([]);
      setLoading(false);
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}/api/watchlist/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setPeople([]);
      setOrgs([]);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setPeople(data?.people ?? []);
    setOrgs(data?.orgs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-500">Loading watchlist…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Watchlist</h1>
        <p className="mt-1 text-sm text-zinc-500">Profiles and orgs you’ve saved.</p>
      </div>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          <User className="h-5 w-5" /> People
        </h2>
        {people.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No people on your watchlist yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {people.map((p) => (
              <li key={p.entity_id}>
                <button
                  type="button"
                  onClick={() => setRoute({ name: "profile", data: { tab: "insights", username: p.username ?? undefined } })}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {p.avatar_url && !isPrivateStorageUrl(p.avatar_url) ? (
                    <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <User className="h-5 w-5 text-zinc-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {p.display_name || p.username || "—"}
                    </span>
                    {p.username && (
                      <span className="ml-2 text-sm text-zinc-500">@{p.username}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          <Building2 className="h-5 w-5" /> Orgs
        </h2>
        {orgs.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No orgs on your watchlist yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {orgs.map((o) => (
              <li key={o.entity_id}>
                <button
                  type="button"
                  onClick={() => setRoute({ name: "orgDetail", data: { orgId: o.entity_id } })}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {o.logo_url && !isPrivateStorageUrl(o.logo_url) ? (
                    <img src={o.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-700">
                      <Building2 className="h-5 w-5 text-zinc-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {o.name || o.slug || "—"}
                    </span>
                    {o.slug && (
                      <span className="ml-2 text-sm text-zinc-500">@{o.slug}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
