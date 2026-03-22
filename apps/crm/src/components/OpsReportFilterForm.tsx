"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Field =
  | { type: "text"; name: string; label: string; placeholder?: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { type: "date"; name: string; label: string };

export function OpsReportFilterForm({
  fields,
  submitLabel = "Apply",
}: {
  fields: Field[];
  submitLabel?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of fields) {
      o[f.name] = sp.get(f.name) ?? "";
    }
    return o;
  });

  const apply = useCallback(() => {
    const next = new URLSearchParams(sp.toString());
    for (const f of fields) {
      const v = local[f.name]?.trim() ?? "";
      if (v === "" || v === "all") next.delete(f.name);
      else next.set(f.name, v);
    }
    startTransition(() => {
      router.push(`?${next.toString()}`);
    });
  }, [fields, local, router, sp]);

  return (
    <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] space-y-3">
      <p className="text-xs font-semibold text-[var(--crm-foreground)]">Filters</p>
      <div className="flex flex-wrap gap-3 items-end">
        {fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1 text-xs text-[var(--crm-muted)] min-w-[140px]">
            <span>{f.label}</span>
            {f.type === "select" ? (
              <select
                className="text-sm border border-[var(--crm-border)] rounded px-2 py-1.5 bg-[var(--crm-background)] text-[var(--crm-foreground)]"
                value={local[f.name] ?? ""}
                onChange={(e) => setLocal((s) => ({ ...s, [f.name]: e.target.value }))}
              >
                {f.options.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === "date" ? "date" : "text"}
                className="text-sm border border-[var(--crm-border)] rounded px-2 py-1.5 bg-[var(--crm-background)] text-[var(--crm-foreground)]"
                placeholder={f.type === "text" ? f.placeholder : undefined}
                value={local[f.name] ?? ""}
                onChange={(e) => setLocal((s) => ({ ...s, [f.name]: e.target.value }))}
              />
            )}
          </label>
        ))}
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          className="text-sm px-4 py-2 rounded-[var(--crm-radius)] bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)] font-medium disabled:opacity-60"
        >
          {pending ? "…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
