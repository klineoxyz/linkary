"use client";

import { useState } from "react";
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

function Flash({ msg, err }: { msg: string; err: boolean }) {
  if (!msg) return null;
  return (
    <p className={`text-sm mt-2 ${err ? "text-red-600" : "text-green-700"}`} role="status">
      {msg}
    </p>
  );
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

export function OpsActionsPanel({ role }: Props) {
  const [flash, setFlash] = useState<{ text: string; err: boolean }>({ text: "", err: false });

  const showComp = canCreateCompGrant(role);
  const showDiscount = canCreateDiscountMetadata(role);
  const showPlan = canCreatePlanOverride(role);
  const showUsage = canResetUsageCounter(role);
  const showRevoke =
    role === "ops_super" ||
    canRevokeEntitlement("comp_grant", role) ||
    canRevokeEntitlement("discount_metadata", role) ||
    canRevokeEntitlement("plan_override", role);

  if (role === "ops_readonly") {
    return (
      <div className="crm-surface-raised p-4 border border-[var(--crm-border)] rounded-[var(--crm-radius)] text-sm text-[var(--crm-muted)]">
        Read-only ops membership: no write forms. Use audit log to review changes.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Flash msg={flash.text} err={flash.err} />

      {showComp && (
        <CompGrantForm
          onDone={(text, err) => {
            setFlash({ text, err });
          }}
        />
      )}

      {showDiscount && (
        <DiscountForm
          onDone={(text, err) => {
            setFlash({ text, err });
          }}
        />
      )}

      {showPlan && (
        <PlanOverrideForm
          onDone={(text, err) => {
            setFlash({ text, err });
          }}
        />
      )}

      {showUsage && (
        <UsageResetForm
          onDone={(text, err) => {
            setFlash({ text, err });
          }}
        />
      )}

      {showRevoke && (
        <RevokeForm
          role={role}
          onDone={(text, err) => {
            setFlash({ text, err });
          }}
        />
      )}
    </div>
  );
}

function fieldClass() {
  return "w-full mt-1 px-2 py-1.5 rounded border border-[var(--crm-border)] bg-[var(--crm-background)] text-[var(--crm-foreground)] text-sm";
}

function localDatetimeInputToIso(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toISOString();
}

function CompGrantForm({ onDone }: { onDone: (t: string, err: boolean) => void }) {
  const [scopes, setScopes] = useState<Set<string>>(new Set(["discovery"]));
  const toggle = (s: string) => {
    setScopes((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  };

  return (
    <form
      className="crm-surface-raised p-4 border border-[var(--crm-border)] rounded-[var(--crm-radius)] space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
          subject_type: fd.get("subject_type"),
          subject_id: fd.get("subject_id"),
          expires_at: localDatetimeInputToIso(fd.get("expires_at")),
          reason: fd.get("reason"),
          replace_existing: fd.get("replace_existing") === "on",
          scopes: Array.from(scopes),
        };
        const { ok, data } = await postJson("/api/ops/writes/comp-grant", payload as Record<string, unknown>);
        onDone(
          ok ? `Comp grant created: ${String((data as { entitlement_id?: string }).entitlement_id ?? "ok")}` : `Error: ${String(data.message ?? data.code ?? "failed")}`,
          !ok
        );
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Temporary comp access</h2>
      <label className="block text-xs text-[var(--crm-muted)]">
        Subject type
        <select name="subject_type" className={fieldClass()} defaultValue="profile">
          <option value="profile">profile</option>
          <option value="org">org</option>
        </select>
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Subject ID (UUID)
        <input name="subject_id" required className={fieldClass()} placeholder="profile or org uuid" />
      </label>
      <div className="text-xs text-[var(--crm-muted)]">
        Scopes
        <div className="flex flex-wrap gap-2 mt-1">
          {OPS_COMP_SCOPES.map((s) => (
            <label key={s} className="flex items-center gap-1 text-[var(--crm-foreground)]">
              <input type="checkbox" checked={scopes.has(s)} onChange={() => toggle(s)} />
              {s}
            </label>
          ))}
        </div>
      </div>
      <label className="block text-xs text-[var(--crm-muted)]">
        Expires at (ISO)
        <input name="expires_at" required className={fieldClass()} type="datetime-local" />
      </label>
      <label className="flex items-center gap-2 text-xs text-[var(--crm-foreground)]">
        <input name="replace_existing" type="checkbox" />
        Replace existing comp rows for this subject (soft-revoke prior active comp grants)
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Reason (required)
        <textarea name="reason" required rows={2} className={fieldClass()} />
      </label>
      <button type="submit" className="text-sm px-3 py-1.5 rounded border border-[var(--crm-border)] bg-[var(--crm-accent)]">
        Create comp grant
      </button>
    </form>
  );
}

function DiscountForm({ onDone }: { onDone: (t: string, err: boolean) => void }) {
  return (
    <form
      className="crm-surface-raised p-4 border border-[var(--crm-border)] rounded-[var(--crm-radius)] space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const po = fd.get("percent_off");
        const payload: Record<string, unknown> = {
          subject_type: fd.get("subject_type"),
          subject_id: fd.get("subject_id"),
          expires_at: localDatetimeInputToIso(fd.get("expires_at")),
          reason: fd.get("reason"),
          stripe_coupon_id: fd.get("stripe_coupon_id") || undefined,
          stripe_customer_id: fd.get("stripe_customer_id") || undefined,
          notes: fd.get("notes") || undefined,
        };
        if (po && String(po).trim() !== "") {
          const n = Number(po);
          if (!Number.isNaN(n)) payload.percent_off = n;
        }
        const { ok, data } = await postJson("/api/ops/writes/discount-metadata", payload);
        onDone(
          ok ? `Discount metadata recorded: ${String((data as { entitlement_id?: string }).entitlement_id ?? "ok")}` : `Error: ${String(data.message ?? data.code ?? "failed")}`,
          !ok
        );
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Discount metadata</h2>
      <p className="text-xs text-[var(--crm-muted)]">
        Records ops context only; prior active discount_metadata rows for this subject are soft-revoked.
      </p>
      <label className="block text-xs text-[var(--crm-muted)]">
        Subject type
        <select name="subject_type" className={fieldClass()} defaultValue="profile">
          <option value="profile">profile</option>
          <option value="org">org</option>
        </select>
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Subject ID
        <input name="subject_id" required className={fieldClass()} />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Expires at
        <input name="expires_at" required className={fieldClass()} type="datetime-local" />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Stripe coupon id (optional)
        <input name="stripe_coupon_id" className={fieldClass()} />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Stripe customer id (optional)
        <input name="stripe_customer_id" className={fieldClass()} />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Percent off (optional)
        <input name="percent_off" type="number" className={fieldClass()} />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Notes (optional)
        <textarea name="notes" rows={2} className={fieldClass()} />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Reason (required)
        <textarea name="reason" required rows={2} className={fieldClass()} />
      </label>
      <button type="submit" className="text-sm px-3 py-1.5 rounded border border-[var(--crm-border)] bg-[var(--crm-accent)]">
        Record discount metadata
      </button>
    </form>
  );
}

function PlanOverrideForm({ onDone }: { onDone: (t: string, err: boolean) => void }) {
  return (
    <form
      className="crm-surface-raised p-4 border border-[var(--crm-border)] rounded-[var(--crm-radius)] space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
          subject_type: fd.get("subject_type"),
          subject_id: fd.get("subject_id"),
          plan_key: fd.get("plan_key"),
          expires_at: localDatetimeInputToIso(fd.get("expires_at")),
          reason: fd.get("reason"),
        };
        const { ok, data } = await postJson("/api/ops/writes/plan-override", payload as Record<string, unknown>);
        onDone(
          ok ? `Plan override created: ${String((data as { entitlement_id?: string }).entitlement_id ?? "ok")}` : `Error: ${String(data.message ?? data.code ?? "failed")}`,
          !ok
        );
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Manual plan override</h2>
      <p className="text-xs text-[var(--crm-muted)]">Prior active plan_override for this subject is soft-revoked.</p>
      <label className="block text-xs text-[var(--crm-muted)]">
        Subject type
        <select name="subject_type" className={fieldClass()} defaultValue="profile">
          <option value="profile">profile</option>
          <option value="org">org</option>
        </select>
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Subject ID
        <input name="subject_id" required className={fieldClass()} />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Plan key
        <select name="plan_key" className={fieldClass()} required>
          <option value="free">free</option>
          <option value="nano">nano</option>
          <option value="kol">kol</option>
          <option value="startup">startup</option>
          <option value="unicorn">unicorn</option>
          <option value="custom">custom</option>
        </select>
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Expires at
        <input name="expires_at" required className={fieldClass()} type="datetime-local" />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Reason (required)
        <textarea name="reason" required rows={2} className={fieldClass()} />
      </label>
      <button type="submit" className="text-sm px-3 py-1.5 rounded border border-[var(--crm-border)] bg-[var(--crm-accent)]">
        Create plan override
      </button>
    </form>
  );
}

function UsageResetForm({ onDone }: { onDone: (t: string, err: boolean) => void }) {
  return (
    <form
      className="crm-surface-raised p-4 border border-[var(--crm-border)] rounded-[var(--crm-radius)] space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
          owner_type: fd.get("owner_type"),
          owner_id: fd.get("owner_id"),
          period_start: fd.get("period_start"),
          metric_key: fd.get("metric_key"),
          admin_note: fd.get("admin_note") || undefined,
          reason: fd.get("reason"),
        };
        const { ok, data } = await postJson("/api/ops/writes/usage-reset", payload as Record<string, unknown>);
        onDone(
          ok
            ? `Counter reset; prior count ${String((data as { prior_count?: number }).prior_count ?? "?")}`
            : `Error: ${String(data.message ?? data.code ?? "failed")}`,
          !ok
        );
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Usage counter reset</h2>
      <p className="text-xs text-[var(--crm-muted)]">
        Sets count to 0 for an existing plan_usage_counters row (exact period + metric). Does not create rows.
      </p>
      <label className="block text-xs text-[var(--crm-muted)]">
        Owner type
        <select name="owner_type" className={fieldClass()} defaultValue="profile">
          <option value="profile">profile</option>
          <option value="org">org</option>
        </select>
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Owner ID
        <input name="owner_id" required className={fieldClass()} />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Period start (UTC date)
        <input name="period_start" required className={fieldClass()} placeholder="YYYY-MM-DD" />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Metric key
        <input name="metric_key" required className={fieldClass()} />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Admin note (optional, stored in audit payload only)
        <input name="admin_note" className={fieldClass()} />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Reason (required)
        <textarea name="reason" required rows={2} className={fieldClass()} />
      </label>
      <button type="submit" className="text-sm px-3 py-1.5 rounded border border-[var(--crm-border)] bg-[var(--crm-accent)]">
        Reset counter
      </button>
    </form>
  );
}

function RevokeForm({ role, onDone }: { role: OpsRole; onDone: (t: string, err: boolean) => void }) {
  const [kind, setKind] = useState<OpsEntitlementKind>("comp_grant");
  const allowed =
    role === "ops_super" ||
    (kind === "comp_grant" && canRevokeEntitlement("comp_grant", role)) ||
    (kind === "discount_metadata" && canRevokeEntitlement("discount_metadata", role)) ||
    (kind === "plan_override" && canRevokeEntitlement("plan_override", role));

  return (
    <form
      className="crm-surface-raised p-4 border border-[var(--crm-border)] rounded-[var(--crm-radius)] space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!allowed) {
          onDone("Your role cannot revoke this kind.", true);
          return;
        }
        const fd = new FormData(e.currentTarget);
        const payload = {
          entitlement_id: fd.get("entitlement_id"),
          reason: fd.get("reason"),
        };
        const { ok, data } = await postJson("/api/ops/writes/revoke", payload as Record<string, unknown>);
        onDone(ok ? "Revoked (soft)." : `Error: ${String(data.message ?? data.code ?? "failed")}`, !ok);
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Revoke entitlement</h2>
      <p className="text-xs text-[var(--crm-muted)]">Soft-revoke by row id (sets revoked_at). Server checks your role against the row kind.</p>
      <label className="block text-xs text-[var(--crm-muted)]">
        Kind (for your reference; server uses row kind)
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as OpsEntitlementKind)}
          className={fieldClass()}
        >
          <option value="comp_grant">comp_grant</option>
          <option value="discount_metadata">discount_metadata</option>
          <option value="plan_override">plan_override</option>
        </select>
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Entitlement ID
        <input name="entitlement_id" required className={fieldClass()} />
      </label>
      <label className="block text-xs text-[var(--crm-muted)]">
        Reason (required)
        <textarea name="reason" required rows={2} className={fieldClass()} />
      </label>
      {!allowed && <p className="text-xs text-amber-700">Select a kind your role may revoke (support: comp only; finance: discount/plan).</p>}
      <button
        type="submit"
        disabled={!allowed}
        className="text-sm px-3 py-1.5 rounded border border-[var(--crm-border)] bg-[var(--crm-accent)] disabled:opacity-50"
      >
        Revoke
      </button>
    </form>
  );
}
