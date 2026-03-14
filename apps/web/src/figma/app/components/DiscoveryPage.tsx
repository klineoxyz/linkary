"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Building2, Lock, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

const DEBOUNCE_MS = 350;
const DEFAULT_LIMIT = 20;

type Tab = "profiles" | "orgs";

type DiscoveryProfile = {
  type: "profile";
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  profile_type?: string | null;
  twitter_username: string | null;
  xscore: number | null;
  analytics_snapshot?: { followers: number | null; engagement_rate: number | null } | null;
  tags?: string[];
};

type DiscoveryOrg = {
  type: "org";
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  twitter_username: string | null;
  xscore: number | null;
  analytics_snapshot?: { followers: number | null; engagement_rate: number | null } | null;
  ecosystem_categories?: string[];
};

type Status = "idle" | "loading" | "success" | "locked" | "unauthorized" | "rate_limited" | "error";

export default function DiscoveryPage({ setRoute }: { setRoute?: (r: { name: string }) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tab, setTab] = useState<Tab>("profiles");
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [orgs, setOrgs] = useState<DiscoveryOrg[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [rateLimitResetAt, setRateLimitResetAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && !session?.access_token) setStatus("unauthorized");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const fetchDiscovery = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setStatus("unauthorized");
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams();
    params.set("limit", String(DEFAULT_LIMIT));
    params.set("offset", "0");
    if (debouncedQ) params.set("q", debouncedQ);

    setStatus("loading");
    setRateLimitResetAt(null);
    setErrorMessage(null);

    const endpoint = tab === "profiles" ? "/api/me/discovery/profiles" : "/api/me/discovery/orgs";
    const res = await fetch(`${base}${endpoint}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      setStatus("unauthorized");
      return;
    }
    if (res.status === 403 && json?.code === "DISCOVERY_NOT_ELIGIBLE") {
      setStatus("locked");
      setProfiles([]);
      setOrgs([]);
      return;
    }
    if (res.status === 429) {
      setStatus("rate_limited");
      setRateLimitResetAt(json?.resetAt ?? null);
      setProfiles([]);
      setOrgs([]);
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setErrorMessage(json?.message ?? "Something went wrong");
      setProfiles([]);
      setOrgs([]);
      return;
    }

    setStatus("success");
    if (tab === "profiles") setProfiles(Array.isArray(json?.profiles) ? json.profiles : []);
    else setOrgs(Array.isArray(json?.orgs) ? json.orgs : []);
  }, [tab, debouncedQ]);

  useEffect(() => {
    if (status === "unauthorized" || status === "locked" || status === "rate_limited") return;
    if (status === "idle" && !debouncedQ) return;
    fetchDiscovery();
  }, [tab, debouncedQ, fetchDiscovery]);

  const hasSearched = debouncedQ.length > 0 || status !== "idle";
  const showStartSearching = status === "idle" && !debouncedQ;
  const showNoResults = hasSearched && status === "success" && (tab === "profiles" ? profiles.length === 0 : orgs.length === 0);

  const goToProfile = (username: string | null) => {
    if (!username) return;
    const slug = String(username).replace(/^@/, "");
    if (slug) router.push(`/${encodeURIComponent(slug)}`);
  };
  const goToOrg = (slug: string) => {
    if (!slug) return;
    router.push(`/${encodeURIComponent(slug)}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-page="discovery">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Discovery</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Search profiles and organizations</p>
      </div>

      {/* Locked state */}
      {status === "locked" && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium text-foreground">Discovery is not available</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Discovery is available on eligible plans. Upgrade or contact support to get access.
          </p>
          {setRoute && (
            <button
              type="button"
              onClick={() => setRoute({ name: "overview" })}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Back to overview
            </button>
          )}
        </div>
      )}

      {/* Unauthorized */}
      {status === "unauthorized" && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium text-foreground">Sign in required</h2>
          <p className="text-sm text-muted-foreground mt-2">Please sign in to use discovery.</p>
          {setRoute && (
            <button
              type="button"
              onClick={() => setRoute({ name: "login" })}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </button>
          )}
        </div>
      )}

      {/* Rate limited */}
      {status === "rate_limited" && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-lg font-medium text-foreground">Too many requests</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {rateLimitResetAt
              ? `Try again after ${new Date(rateLimitResetAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`
              : "Please wait a moment before searching again."}
          </p>
          <button
            type="button"
            onClick={() => { setStatus("idle"); setDebouncedQ(""); }}
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            OK
          </button>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-lg font-medium text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-2">{errorMessage ?? "Please try again."}</p>
          <button
            type="button"
            onClick={fetchDiscovery}
            className="mt-4 inline-flex items-center gap-2 justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      {/* Search UI when not locked/unauthorized/rate_limited/error */}
      {status !== "locked" && status !== "unauthorized" && status !== "rate_limited" && status !== "error" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, handle, or bio..."
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                aria-label="Search discovery"
              />
            </div>
            <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setTab("profiles")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "profiles" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Users className="h-4 w-4" /> Profiles
              </button>
              <button
                type="button"
                onClick={() => setTab("orgs")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "orgs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Building2 className="h-4 w-4" /> Orgs
              </button>
            </div>
          </div>

          {/* Start searching */}
          {showStartSearching && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
              <Search className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm font-medium text-foreground">Start searching</p>
              <p className="text-sm text-muted-foreground mt-1">Enter a name, handle, or keyword to discover profiles and organizations.</p>
            </div>
          )}

          {/* Loading */}
          {status === "loading" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="h-12 w-12 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-3 w-full bg-muted rounded" />
                      <div className="h-3 w-2/3 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <Search className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm font-medium text-foreground">No results</p>
              <p className="text-sm text-muted-foreground mt-1">Try a different search term.</p>
            </div>
          )}

          {/* Results */}
          {status === "success" && !showNoResults && tab === "profiles" && profiles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profiles.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToProfile(p.username)}
                  className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:bg-accent/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <div className="flex gap-3">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted shrink-0 flex items-center justify-center">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{p.display_name || p.username || p.twitter_username || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.username ? `@${p.username.replace(/^@/, "")}` : p.twitter_username ? `@${p.twitter_username.replace(/^@/, "")}` : ""}
                      </p>
                      {p.bio && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.bio}</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {p.profile_type && (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {p.profile_type}
                          </span>
                        )}
                        {p.xscore != null && Number.isFinite(p.xscore) && (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            XScore {p.xscore}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {status === "success" && !showNoResults && tab === "orgs" && orgs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {orgs.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToOrg(o.slug)}
                  className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:bg-accent/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <div className="flex gap-3">
                    {o.logo_url ? (
                      <img src={o.logo_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted shrink-0 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{o.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.slug ? `@${o.slug}` : ""}</p>
                      {o.tagline && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{o.tagline}</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {o.xscore != null && Number.isFinite(o.xscore) && (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            XScore {o.xscore}
                          </span>
                        )}
                        {(o.ecosystem_categories?.length ?? 0) > 0 && (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {o.ecosystem_categories!.slice(0, 2).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
