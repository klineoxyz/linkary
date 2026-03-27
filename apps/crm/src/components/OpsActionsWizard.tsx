"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsRole } from "@/lib/internalOps";
import { OPS_COMP_SCOPES } from "@/lib/opsWritesValidation";
import {
  canCreateCompGrant,
  canCreateDiscountMetadata,
  canCreatePlanOverride,
  canResetUsageCounter,
  canRevokeEntitlement,
} from "@/lib/opsWritePermissions";
import type { OpsEntitlementKind } from "@/lib/opsWritePermissions";

type Props = { role: OpsRole };

type SearchHit =
  | { type: "profile"; id: string; username: string | null; display_name: string | null; email: string | null }
  | { type: "org"; id: string; name: string | null; slug: string | null };

type ContextEntitlement = {
  id: string;
  kind: string;
  expires_at: string;
  payload_json: unknown;
  reason: string;
  created_at: string;
};

type SubjectContext = {
  subject_type: "profile" | "org";
  subject_id: string;
  subscription: {
    plan_key: string | null;
    tier: string | null;
    status: string | null;
    current_period_end: string | null;
  } | null;
  effectivePlanKey: string | null;
  baseEffectivePlanKey: string | null;
  activePlanOverride: string | null;
  activeCompGrant: boolean;
  activeDiscountMetadata: boolean;
  entitlements: ContextEntitlement[];
};

const PLAN_OPTIONS = ["free", "nano", "kol", "startup", "unicorn", "custom"] as const;

const FULL_ACCESS_SCOPES = [...OPS_COMP_SCOPES];

function fieldClass() {
  return "w-full mt-1 px-2 py-1.5 rounded border border-[var(--crm-border)] bg-[var(--crm-background)] text-[var(--crm-foreground)] text-sm";
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

function localDatetimeToIso(value: string): string {
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toISOString();
}

async function postJson(path: string, payload: Record<string, unknown>) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

function hitLabel(h: SearchHit): string {
  if (h.type === "profile") {
    const u = h.username ? `@${h.username.replace(/^@/, "")}` : "—";
    const n = h.display_name?.trim() || "";
    const e = h.email?.trim() || "";
    return `${u}${n ? ` · ${n}` : ""}${e ? ` · ${e}` : ""}`;
  }
  return `${h.name ?? "Org"} (${h.slug ?? h.id.slice(0, 8)}…)`;
}

export function OpsActionsWizard({ role }: Props) {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<{ profiles: SearchHit[]; orgs: SearchHit[] }>({ profiles: [], orgs: [] });
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctx, setCtx] = useState<SubjectContext | null>(null);
  const [flash, setFlash] = useState<{ text: string; err: boolean }>({ text: "", err: false });

  const [actionKind, setActionKind] = useState<"comp" | "discount" | "plan" | "revoke" | "usage" | "">("");
  const [durationPreset, setDurationPreset] = useState<7 | 30 | 90 | "custom">(30);
  const [customUntil, setCustomUntil] = useState("");
  const [planKey, setPlanKey] = useState<string>("kol");
  const [percentOff, setPercentOff] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [revokeId, setRevokeId] = useState("");
  const [revokeKind, setRevokeKind] = useState<OpsEntitlementKind>("comp_grant");
  const [usagePeriod, setUsagePeriod] = useState("");
  const [usageMetric, setUsageMetric] = useState("");
  const [usageNote, setUsageNote] = useState("");
  const [showAdvancedDiscount, setShowAdvancedDiscount] = useState(false);
  const [stripeCoupon, setStripeCoupon] = useState("");
  const [stripeCustomer, setStripeCustomer] = useState("");
  const [discountNotes, setDiscountNotes] = useState("");

  const showComp = canCreateCompGrant(role);
  const showDiscount = canCreateDiscountMetadata(role);
  const showPlan = canCreatePlanOverride(role);
  const showUsage = canResetUsageCounter(role);
  const showRevoke =
    role === "ops_super" ||
    canRevokeEntitlement("comp_grant", role) ||
    canRevokeEntitlement("discount_metadata", role) ||
    canRevokeEntitlement("plan_override", role);

  const loadContext = useCallback(async (hit: SearchHit) => {
    setCtxLoading(true);
    setCtx(null);
    try {
      const res = await fetch(
        `/api/ops/subject-context?subject_type=${hit.type}&subject_id=${encodeURIComponent(hit.id)}`,
        { credentials: "include" }
      );
      const json = (await res.json()) as { ok?: boolean; data?: SubjectContext };
      if (json.ok && json.data) setCtx(json.data);
      else setFlash({ text: "Could not load subject context.", err: true });
    } finally {
      setCtxLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadContext(selected);
  }, [selected, loadContext]);

  const runSearch = async () => {
    setSearching(true);
    setFlash({ text: "", err: false });
    try {
      const res = await fetch(`/api/ops/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { profiles: SearchHit[]; orgs: SearchHit[] };
      };
      if (json.ok && json.data) {
        setHits({ profiles: json.data.profiles, orgs: json.data.orgs });
        if (!json.data.profiles.length && !json.data.orgs.length) {
          setFlash({ text: "No matches (try email, @handle, name, or org name).", err: false });
        }
      }
    } finally {
      setSearching(false);
    }
  };

  const resolveExpiresAt = (): string | null => {
    if (durationPreset === "custom") {
      if (!customUntil.trim()) return null;
      const iso = localDatetimeToIso(customUntil);
      if (!iso || Date.parse(iso) <= Date.now()) return null;
      return iso;
    }
    const iso = addDaysIso(durationPreset);
    return Date.parse(iso) > Date.now() ? iso : null;
  };

  const submitComp = async () => {
    if (!selected || !reason.trim()) {
      setFlash({ text: "Select a subject and enter a reason (min 3 chars).", err: true });
      return;
    }
    const expires_at = resolveExpiresAt();
    if (!expires_at) {
      setFlash({ text: "Choose a valid end date in the future.", err: true });
      return;
    }
    const { ok, data } = await postJson("/api/ops/writes/comp-grant", {
      subject_type: selected.type,
      subject_id: selected.id,
      expires_at,
      reason: reason.trim(),
      scopes: FULL_ACCESS_SCOPES,
      replace_existing: replaceExisting,
    });
    setFlash({
      text: ok ? `Comp grant OK: ${String((data as { entitlement_id?: string }).entitlement_id ?? "")}` : String(data.message ?? "Failed"),
      err: !ok,
    });
    if (ok && selected) void loadContext(selected);
  };

  const submitDiscount = async () => {
    if (!selected || !reason.trim()) {
      setFlash({ text: "Select a subject and enter a reason.", err: true });
      return;
    }
    const expires_at = resolveExpiresAt();
    if (!expires_at) {
      setFlash({ text: "Choose a valid end date.", err: true });
      return;
    }
    const payload: Record<string, unknown> = {
      subject_type: selected.type,
      subject_id: selected.id,
      expires_at,
      reason: reason.trim(),
    };
    if (percentOff !== "" && Number.isFinite(Number(percentOff))) payload.percent_off = Number(percentOff);
    if (showAdvancedDiscount) {
      if (stripeCoupon.trim()) payload.stripe_coupon_id = stripeCoupon.trim();
      if (stripeCustomer.trim()) payload.stripe_customer_id = stripeCustomer.trim();
      if (discountNotes.trim()) payload.notes = discountNotes.trim();
    }
    const { ok, data } = await postJson("/api/ops/writes/discount-metadata", payload);
    setFlash({
      text: ok ? `Discount metadata recorded: ${String((data as { entitlement_id?: string }).entitlement_id ?? "")}` : String(data.message ?? "Failed"),
      err: !ok,
    });
    if (ok && selected) void loadContext(selected);
  };

  const submitPlan = async () => {
    if (!selected || !reason.trim()) {
      setFlash({ text: "Select a subject and enter a reason.", err: true });
      return;
    }
    const expires_at = resolveExpiresAt();
    if (!expires_at) {
      setFlash({ text: "Choose a valid end date.", err: true });
      return;
    }
    const { ok, data } = await postJson("/api/ops/writes/plan-override", {
      subject_type: selected.type,
      subject_id: selected.id,
      plan_key: planKey,
      expires_at,
      reason: reason.trim(),
    });
    setFlash({
      text: ok ? `Plan override OK: ${String((data as { entitlement_id?: string }).entitlement_id ?? "")}` : String(data.message ?? "Failed"),
      err: !ok,
    });
    if (ok && selected) void loadContext(selected);
  };

  const submitRevoke = async () => {
    if (!reason.trim() || !revokeId.trim()) {
      setFlash({ text: "Pick an entitlement row and enter a reason.", err: true });
      return;
    }
    const allowed =
      role === "ops_super" ||
      (revokeKind === "comp_grant" && canRevokeEntitlement("comp_grant", role)) ||
      (revokeKind === "discount_metadata" && canRevokeEntitlement("discount_metadata", role)) ||
      (revokeKind === "plan_override" && canRevokeEntitlement("plan_override", role));
    if (!allowed) {
      setFlash({ text: "Your role cannot revoke that kind.", err: true });
      return;
    }
    const { ok, data } = await postJson("/api/ops/writes/revoke", {
      entitlement_id: revokeId.trim(),
      reason: reason.trim(),
    });
    setFlash({ text: ok ? "Revoked (soft)." : String(data.message ?? "Failed"), err: !ok });
    if (selected) void loadContext(selected);
  };

  const submitUsage = async () => {
    if (!selected || !reason.trim() || !usagePeriod.trim() || !usageMetric.trim()) {
      setFlash({ text: "Subject, period YYYY-MM-DD, metric, and reason required.", err: true });
      return;
    }
    const { ok, data } = await postJson("/api/ops/writes/usage-reset", {
      owner_type: selected.type,
      owner_id: selected.id,
      period_start: usagePeriod.trim(),
      metric_key: usageMetric.trim(),
      admin_note: usageNote.trim() || undefined,
      reason: reason.trim(),
    });
    setFlash({
      text: ok ? `Usage reset OK (prior ${String((data as { prior_count?: number }).prior_count ?? "?")})` : String(data.message ?? "Failed"),
      err: !ok,
    });
  };

  return (
    <div className="space-y-8">
      {flash.text ? (
        <p className={`text-sm ${flash.err ? "text-red-600" : "text-green-700"}`} role="status">
          {flash.text}
        </p>
      ) : null}

      <section className="crm-surface-raised p-5 rounded-[var(--crm-radius)] border border-[var(--crm-border)] space-y-4">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">1 · Find account</h2>
        <p className="text-xs text-[var(--crm-muted)]">
          Search profiles by username, display name, or email. Search orgs by name or slug. The UUID is filled in for you after
          selection — you should not need to paste IDs for normal work.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block flex-1 min-w-[12rem] text-xs text-[var(--crm-muted)]">
            Query
            <input
              className={fieldClass()}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. @handle, name, or email"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void runSearch())}
            />
          </label>
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching || q.trim().length < 2}
            className="px-4 py-2 rounded-[var(--crm-radius)] bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)] text-sm font-medium disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {(hits.profiles.length > 0 || hits.orgs.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {hits.profiles.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-[var(--crm-muted)] mb-2">Profiles</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {hits.profiles.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(h);
                          setActionKind("");
                        }}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded border ${
                          selected?.type === "profile" && selected.id === h.id
                            ? "border-[var(--crm-primary)] bg-[var(--crm-accent)]"
                            : "border-[var(--crm-border)] hover:bg-[var(--crm-accent)]"
                        }`}
                      >
                        {hitLabel(h)}
                        <span className="block font-mono text-[10px] text-[var(--crm-muted)] mt-0.5">{h.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hits.orgs.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-[var(--crm-muted)] mb-2">Orgs</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {hits.orgs.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(h);
                          setActionKind("");
                        }}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded border ${
                          selected?.type === "org" && selected.id === h.id
                            ? "border-[var(--crm-primary)] bg-[var(--crm-accent)]"
                            : "border-[var(--crm-border)] hover:bg-[var(--crm-accent)]"
                        }`}
                      >
                        {hitLabel(h)}
                        <span className="block font-mono text-[10px] text-[var(--crm-muted)] mt-0.5">{h.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {selected && (
        <section className="crm-surface-raised p-5 rounded-[var(--crm-radius)] border border-[var(--crm-border)] space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">2 · Current access</h2>
              <p className="text-xs text-[var(--crm-muted)] mt-1">
                Selected: <strong className="text-[var(--crm-foreground)]">{hitLabel(selected)}</strong> ·{" "}
                <span className="font-mono">{selected.id}</span>
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-[var(--crm-muted)] hover:text-[var(--crm-foreground)]"
              onClick={() => {
                setSelected(null);
                setCtx(null);
                setActionKind("");
              }}
            >
              Clear selection
            </button>
          </div>

          {ctxLoading ? (
            <p className="text-sm text-[var(--crm-muted)]">Loading subscription &amp; entitlements…</p>
          ) : ctx ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[var(--crm-radius)] border border-[var(--crm-border)] p-3 bg-[var(--crm-background)]">
                  <p className="text-[10px] uppercase text-[var(--crm-muted)] mb-1">Active subscription (if any)</p>
                  {ctx.subscription ? (
                    <ul className="text-xs space-y-0.5 text-[var(--crm-foreground)]">
                      <li>
                        Status: <strong>{ctx.subscription.status}</strong>
                      </li>
                      <li>plan_key (raw): {ctx.subscription.plan_key ?? "—"}</li>
                      <li>tier (legacy): {ctx.subscription.tier ?? "—"}</li>
                      <li>
                        Effective plan: <strong>{ctx.effectivePlanKey ?? "free"}</strong>
                      </li>
                      <li>Base effective plan (subscription): {ctx.baseEffectivePlanKey ?? "free"}</li>
                      <li>Active plan override: {ctx.activePlanOverride ?? "none"}</li>
                      <li>current_period_end: {ctx.subscription.current_period_end ?? "—"}</li>
                    </ul>
                  ) : (
                    <ul className="text-xs space-y-0.5 text-[var(--crm-foreground)]">
                      <li>No active subscription row for this owner.</li>
                      <li>
                        Effective plan: <strong>{ctx.effectivePlanKey ?? "free"}</strong>
                      </li>
                      <li>Active plan override: {ctx.activePlanOverride ?? "none"}</li>
                    </ul>
                  )}
                </div>
                <div className="rounded-[var(--crm-radius)] border border-[var(--crm-border)] p-3 bg-[var(--crm-background)]">
                  <p className="text-[10px] uppercase text-[var(--crm-muted)] mb-1">Active ops entitlements</p>
                  <p className="text-[10px] text-[var(--crm-muted)] mb-2">
                    Comp: {ctx.activeCompGrant ? "yes" : "no"} · Discount metadata:{" "}
                    {ctx.activeDiscountMetadata ? "yes" : "no"}
                  </p>
                  {ctx.entitlements.length === 0 ? (
                    <p className="text-xs text-[var(--crm-muted)]">None (non-revoked, future expiry).</p>
                  ) : (
                    <div className="overflow-x-auto max-h-36 overflow-y-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                            <th className="py-1 pr-1">kind</th>
                            <th className="py-1 pr-1">expires</th>
                            <th className="py-1">id</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ctx.entitlements.map((e) => (
                            <tr key={e.id} className="border-b border-[var(--crm-border)]/50">
                              <td className="py-1 pr-1 font-mono">{e.kind}</td>
                              <td className="py-1 pr-1 whitespace-nowrap">{new Date(e.expires_at).toLocaleString()}</td>
                              <td className="py-1 font-mono break-all">{e.id}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">3 · Action</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {showComp && (
                    <button
                      type="button"
                      onClick={() => setActionKind("comp")}
                      className={`text-xs px-3 py-1.5 rounded border ${
                        actionKind === "comp"
                          ? "border-[var(--crm-primary)] bg-[var(--crm-accent)]"
                          : "border-[var(--crm-border)]"
                      }`}
                    >
                      Grant comp access
                    </button>
                  )}
                  {showDiscount && (
                    <button
                      type="button"
                      onClick={() => setActionKind("discount")}
                      className={`text-xs px-3 py-1.5 rounded border ${
                        actionKind === "discount"
                          ? "border-[var(--crm-primary)] bg-[var(--crm-accent)]"
                          : "border-[var(--crm-border)]"
                      }`}
                    >
                      Discount metadata
                    </button>
                  )}
                  {showPlan && (
                    <button
                      type="button"
                      onClick={() => setActionKind("plan")}
                      className={`text-xs px-3 py-1.5 rounded border ${
                        actionKind === "plan"
                          ? "border-[var(--crm-primary)] bg-[var(--crm-accent)]"
                          : "border-[var(--crm-border)]"
                      }`}
                    >
                      Plan override
                    </button>
                  )}
                  {showRevoke && (
                    <button
                      type="button"
                      onClick={() => setActionKind("revoke")}
                      className={`text-xs px-3 py-1.5 rounded border ${
                        actionKind === "revoke"
                          ? "border-[var(--crm-primary)] bg-[var(--crm-accent)]"
                          : "border-[var(--crm-border)]"
                      }`}
                    >
                      Revoke entitlement
                    </button>
                  )}
                  {showUsage && (
                    <button
                      type="button"
                      onClick={() => setActionKind("usage")}
                      className={`text-xs px-3 py-1.5 rounded border ${
                        actionKind === "usage"
                          ? "border-[var(--crm-primary)] bg-[var(--crm-accent)]"
                          : "border-[var(--crm-border)]"
                      }`}
                    >
                      Reset usage counter
                    </button>
                  )}
                </div>

                {(actionKind === "comp" || actionKind === "discount" || actionKind === "plan") && (
                  <div className="space-y-3 border border-[var(--crm-border)] rounded-[var(--crm-radius)] p-4 bg-[var(--crm-background)]/60">
                    <p className="text-xs font-medium text-[var(--crm-foreground)]">Duration</p>
                    <div className="flex flex-wrap gap-2">
                      {([7, 30, 90] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setDurationPreset(d);
                          }}
                          className={`text-xs px-2 py-1 rounded border ${
                            durationPreset === d ? "border-[var(--crm-primary)] bg-[var(--crm-accent)]" : "border-[var(--crm-border)]"
                          }`}
                        >
                          {d} days
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDurationPreset("custom")}
                        className={`text-xs px-2 py-1 rounded border ${
                          durationPreset === "custom"
                            ? "border-[var(--crm-primary)] bg-[var(--crm-accent)]"
                            : "border-[var(--crm-border)]"
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {durationPreset === "custom" && (
                      <label className="block text-xs text-[var(--crm-muted)]">
                        Until (local)
                        <input
                          type="datetime-local"
                          className={fieldClass()}
                          value={customUntil}
                          onChange={(e) => setCustomUntil(e.target.value)}
                        />
                      </label>
                    )}
                    {actionKind === "comp" && (
                      <label className="flex items-center gap-2 text-xs text-[var(--crm-foreground)]">
                        <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
                        Replace prior active comp rows for this subject
                      </label>
                    )}
                    {actionKind === "comp" && (
                      <p className="text-[10px] text-[var(--crm-muted)]">
                        Scopes: {FULL_ACCESS_SCOPES.join(", ")} (full platform comp bundle).
                      </p>
                    )}
                    {actionKind === "plan" && (
                      <label className="block text-xs text-[var(--crm-muted)]">
                        Override plan_key
                        <select className={fieldClass()} value={planKey} onChange={(e) => setPlanKey(e.target.value)}>
                          {PLAN_OPTIONS.map((pk) => (
                            <option key={pk} value={pk}>
                              {pk}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {actionKind === "discount" && (
                      <>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs text-[var(--crm-muted)]">Quick %:</span>
                          {[25, 50].map((n) => (
                            <button
                              key={n}
                              type="button"
                              className="text-xs px-2 py-1 rounded border border-[var(--crm-border)]"
                              onClick={() => setPercentOff(n)}
                            >
                              {n}%
                            </button>
                          ))}
                          <button type="button" className="text-xs px-2 py-1 rounded border border-[var(--crm-border)]" onClick={() => setPercentOff("")}>
                            Clear %
                          </button>
                        </div>
                        <label className="block text-xs text-[var(--crm-muted)]">
                          Custom percent off (optional)
                          <input
                            type="number"
                            className={fieldClass()}
                            value={percentOff === "" ? "" : percentOff}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPercentOff(v === "" ? "" : Number(v));
                            }}
                          />
                        </label>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-[var(--crm-muted)]">Advanced (Stripe &amp; notes)</summary>
                          <div className="mt-2 space-y-2 pl-1 border-l border-[var(--crm-border)]">
                            <label className="flex items-center gap-2 text-[var(--crm-foreground)]">
                              <input type="checkbox" checked={showAdvancedDiscount} onChange={(e) => setShowAdvancedDiscount(e.target.checked)} />
                              Show optional Stripe / notes fields
                            </label>
                            {showAdvancedDiscount && (
                              <>
                                <input
                                  className={fieldClass()}
                                  placeholder="stripe_coupon_id"
                                  value={stripeCoupon}
                                  onChange={(e) => setStripeCoupon(e.target.value)}
                                />
                                <input
                                  className={fieldClass()}
                                  placeholder="stripe_customer_id"
                                  value={stripeCustomer}
                                  onChange={(e) => setStripeCustomer(e.target.value)}
                                />
                                <textarea
                                  className={fieldClass()}
                                  placeholder="notes"
                                  rows={2}
                                  value={discountNotes}
                                  onChange={(e) => setDiscountNotes(e.target.value)}
                                />
                              </>
                            )}
                          </div>
                        </details>
                      </>
                    )}
                    <label className="block text-xs text-[var(--crm-muted)]">
                      Reason (required, audit)
                      <textarea className={fieldClass()} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (actionKind === "comp") void submitComp();
                        if (actionKind === "discount") void submitDiscount();
                        if (actionKind === "plan") void submitPlan();
                      }}
                      className="px-4 py-2 rounded-[var(--crm-radius)] bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)] text-sm font-medium"
                    >
                      Submit
                    </button>
                  </div>
                )}

                {actionKind === "revoke" && (
                  <div className="space-y-3 border border-[var(--crm-border)] rounded-[var(--crm-radius)] p-4">
                    <label className="block text-xs text-[var(--crm-muted)]">
                      Kind (for permission check)
                      <select className={fieldClass()} value={revokeKind} onChange={(e) => setRevokeKind(e.target.value as OpsEntitlementKind)}>
                        <option value="comp_grant">comp_grant</option>
                        <option value="discount_metadata">discount_metadata</option>
                        <option value="plan_override">plan_override</option>
                      </select>
                    </label>
                    <label className="block text-xs text-[var(--crm-muted)]">
                      Entitlement id (choose active row)
                      <select className={fieldClass()} value={revokeId} onChange={(e) => setRevokeId(e.target.value)}>
                        <option value="">— select —</option>
                        {ctx.entitlements.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.kind} · {e.id.slice(0, 8)}… · {new Date(e.expires_at).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-[var(--crm-muted)]">
                      Or paste entitlement UUID
                      <input className={fieldClass()} value={revokeId} onChange={(e) => setRevokeId(e.target.value)} placeholder="xxxxxxxx-xxxx-…" />
                    </label>
                    <label className="block text-xs text-[var(--crm-muted)]">
                      Reason
                      <textarea className={fieldClass()} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </label>
                    <button
                      type="button"
                      onClick={() => void submitRevoke()}
                      className="px-4 py-2 rounded-[var(--crm-radius)] bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)] text-sm font-medium"
                    >
                      Revoke
                    </button>
                  </div>
                )}

                {actionKind === "usage" && (
                  <div className="space-y-3 border border-[var(--crm-border)] rounded-[var(--crm-radius)] p-4">
                    <p className="text-xs text-[var(--crm-muted)]">
                      Owner is the selected subject ({selected.type}). Requires an existing plan_usage_counters row.
                    </p>
                    <label className="block text-xs text-[var(--crm-muted)]">
                      Period start (UTC YYYY-MM-DD)
                      <input className={fieldClass()} value={usagePeriod} onChange={(e) => setUsagePeriod(e.target.value)} placeholder="2025-03-01" />
                    </label>
                    <label className="block text-xs text-[var(--crm-muted)]">
                      Metric key
                      <input className={fieldClass()} value={usageMetric} onChange={(e) => setUsageMetric(e.target.value)} />
                    </label>
                    <label className="block text-xs text-[var(--crm-muted)]">
                      Admin note (optional, audit payload only)
                      <input className={fieldClass()} value={usageNote} onChange={(e) => setUsageNote(e.target.value)} />
                    </label>
                    <label className="block text-xs text-[var(--crm-muted)]">
                      Reason
                      <textarea className={fieldClass()} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </label>
                    <button
                      type="button"
                      onClick={() => void submitUsage()}
                      className="px-4 py-2 rounded-[var(--crm-radius)] bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)] text-sm font-medium"
                    >
                      Reset counter
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
