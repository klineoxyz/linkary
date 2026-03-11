"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, Link2, Copy, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ADMIN_TWITTER = "muazxinthi";

type AdminCode = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  batch_allocated_to_type: string;
  batch_allocated_to_id: string;
  batch_allocated_to_label: string;
  issued_by_type: string;
  issued_by_id: string;
  issued_by_label: string;
  redeemed_by_profile_id: string | null;
  redeemed_by_username: string | null;
};

type AdminCodesResponse = {
  summary: Record<string, number>;
  codes: AdminCode[];
};

export default function AdminInvitesPage({ setRoute, me }: { setRoute?: (r: any) => void; me?: { id: string; twitter_username?: string | null } | null }) {
  const [allowed, setAllowed] = useState(false);
  const [allocateType, setAllocateType] = useState<"profile" | "org">("profile");
  const [allocateId, setAllocateId] = useState("");
  const [allocateCount, setAllocateCount] = useState(5);
  const [allocateLoading, setAllocateLoading] = useState(false);
  const [allocateError, setAllocateError] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<AdminCodesResponse | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [opsStats, setOpsStats] = useState<{
    creator_invites?: Record<string, number>;
    jobs_zero_applicants?: number;
    open_jobs_total?: number;
  } | null>(null);

  const loadOpsStats = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/invites/admin-stats`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (res.ok && !json.error) setOpsStats(json);
  }, []);

  useEffect(() => {
    const twitter = (me?.twitter_username ?? "").replace(/^@/, "").toLowerCase();
    setAllowed(twitter === ADMIN_TWITTER);
  }, [me?.twitter_username]);

  const loadAdminCodes = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setAdminLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("limit", "300");
      const res = await fetch(`${base}/api/invites/admin-codes?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.summary != null) setAdminData({ summary: json.summary, codes: Array.isArray(json.codes) ? json.codes : [] });
      else setAdminData(null);
    } finally {
      setAdminLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    if (allowed) {
      loadAdminCodes();
      loadOpsStats();
    }
  }, [allowed, loadAdminCodes, loadOpsStats]);

  const handleAllocate = async () => {
    if (!allocateId.trim()) {
      setAllocateError("Enter profile or org ID (UUID).");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    if (!token || !base) return;
    setAllocateLoading(true);
    setAllocateError(null);
    const res = await fetch(`${base}/api/invites/allocate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        allocated_to_type: allocateType,
        allocated_to_id: allocateId.trim(),
        count: Math.min(Math.max(allocateCount, 1), 1000),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setAllocateLoading(false);
    if (res.ok) {
      setAllocateId("");
      setAllocateCount(5);
      loadAdminCodes();
    } else {
      setAllocateError(json?.error ?? "Allocate failed");
    }
  };

  const copyAsCsv = () => {
    if (!adminData?.codes?.length) return;
    const headers = ["code", "status", "allocated_to", "issued_by", "redeemed_by", "created_at"];
    const rows = adminData.codes.map((c) => [
      c.code,
      c.status,
      c.batch_allocated_to_label || `${c.batch_allocated_to_type}:${c.batch_allocated_to_id}`,
      c.issued_by_label || c.issued_by_id,
      c.redeemed_by_username || "",
      c.created_at,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    navigator.clipboard.writeText(csv).then(() => {
      setCopyFeedback("Copied as CSV");
      setTimeout(() => setCopyFeedback(null), 2000);
    });
  };

  if (!allowed) {
    return (
      <div className="space-y-6 max-w-2xl">
        {setRoute && (
          <button type="button" onClick={() => setRoute({ name: "overview" })} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
        <p className="text-destructive">Access restricted.</p>
      </div>
    );
  }

  const summary = adminData?.summary ?? {};
  const codes = adminData?.codes ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      {setRoute && (
        <button type="button" onClick={() => setRoute({ name: "overview" })} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Invite ops (admin)</h1>
        <p className="text-sm text-muted-foreground">Allocate batches, view codes, and see redemption status.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="font-medium text-foreground">Allocate batch</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">To</label>
            <select
              value={allocateType}
              onChange={(e) => setAllocateType(e.target.value as "profile" | "org")}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="profile">Profile</option>
              <option value="org">Org</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">ID (UUID)</label>
            <input
              type="text"
              value={allocateId}
              onChange={(e) => setAllocateId(e.target.value)}
              placeholder="Profile or org UUID"
              className="h-9 w-48 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Count</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={allocateCount}
              onChange={(e) => setAllocateCount(Number(e.target.value) || 1)}
              className="h-9 w-20 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAllocate}
            disabled={allocateLoading}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            {allocateLoading ? "…" : "Allocate"}
          </button>
        </div>
        {allocateError && <p className="text-sm text-destructive">{allocateError}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="font-medium text-foreground">Code breakdown</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-muted-foreground">Available: <strong className="text-foreground">{summary.available ?? 0}</strong></span>
          <span className="text-muted-foreground">Redeemed: <strong className="text-foreground">{summary.redeemed ?? 0}</strong></span>
          <span className="text-muted-foreground">Revoked: <strong className="text-foreground">{summary.revoked ?? 0}</strong></span>
          <span className="text-muted-foreground">Expired: <strong className="text-foreground">{summary.expired ?? 0}</strong></span>
          <span className="text-muted-foreground">Reserved: <strong className="text-foreground">{summary.reserved ?? 0}</strong></span>
        </div>
      </div>

      {opsStats && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-medium text-foreground">Ops snapshot</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            {opsStats.creator_invites && (
              <>
                <span className="text-muted-foreground">Creator invites (pending): <strong className="text-foreground">{opsStats.creator_invites.invited ?? 0}</strong></span>
                <span className="text-muted-foreground">Accepted: <strong className="text-foreground">{opsStats.creator_invites.accepted ?? 0}</strong></span>
                <span className="text-muted-foreground">Declined: <strong className="text-foreground">{opsStats.creator_invites.declined ?? 0}</strong></span>
              </>
            )}
            {typeof opsStats.jobs_zero_applicants === "number" && (
              <span className="text-muted-foreground">Open jobs with 0 applicants: <strong className="text-foreground">{opsStats.jobs_zero_applicants}</strong> {opsStats.open_jobs_total != null ? `/ ${opsStats.open_jobs_total} open` : ""}</span>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-foreground">Invite codes</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="available">Available</option>
              <option value="redeemed">Redeemed</option>
              <option value="revoked">Revoked</option>
              <option value="expired">Expired</option>
              <option value="reserved">Reserved</option>
            </select>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code"
                className="h-8 pl-8 pr-2 w-40 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <button type="button" onClick={loadAdminCodes} className="h-8 px-2 text-xs text-primary hover:underline">Refresh</button>
            <button
              type="button"
              onClick={copyAsCsv}
              disabled={!codes.length}
              className="flex items-center gap-1 h-8 px-2 rounded border border-border text-xs hover:bg-muted"
            >
              <Copy className="h-3 w-3" /> {copyFeedback ?? "Copy as CSV"}
            </button>
          </div>
        </div>
        {adminLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No codes match. Allocate a batch or change filters.</p>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-border rounded-lg">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-muted/80">
                <tr>
                  <th className="text-left p-2 font-medium">Code</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">Allocated to</th>
                  <th className="text-left p-2 font-medium">Issued by</th>
                  <th className="text-left p-2 font-medium">Redeemed by</th>
                  <th className="text-left p-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-2 font-mono text-xs">{c.code}</td>
                    <td className="p-2">{c.status}</td>
                    <td className="p-2 text-muted-foreground">{c.batch_allocated_to_label || "—"}</td>
                    <td className="p-2 text-muted-foreground">{c.issued_by_label || "—"}</td>
                    <td className="p-2">{c.redeemed_by_username ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium text-foreground mb-2">Who invited whom</h2>
        <p className="text-sm text-muted-foreground mb-2">View invite lineage (inviter → invitee chain) for your account.</p>
        <button
          type="button"
          onClick={() => setRoute?.({ name: "inviteLineage" })}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Link2 className="h-4 w-4" />
          Open Invite lineage
        </button>
      </div>
    </div>
  );
}
