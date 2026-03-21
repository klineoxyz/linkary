"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateParticipantFollowVerificationAction } from "./actions";
import { parseAttestation, parseVerification } from "@/lib/followRules";

export function ParticipantFollowReviewCell({
  campaignId,
  participantRowId,
  attestationJson,
  verificationJson,
}: {
  campaignId: string;
  participantRowId: string;
  attestationJson: unknown;
  verificationJson: unknown;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [note, setNote] = useState("");

  const v = parseVerification(verificationJson);
  const a = parseAttestation(attestationJson);

  async function run(
    status: "pending" | "verified" | "waived",
    opts?: { waiveReason?: string; note?: string }
  ) {
    setError(null);
    setLoading(true);
    const noteRaw = opts?.note !== undefined ? opts.note : note;
    const waiveRaw = opts?.waiveReason !== undefined ? opts.waiveReason : waiveReason;
    const res = await updateParticipantFollowVerificationAction(
      campaignId,
      participantRowId,
      status,
      noteRaw.trim() || null,
      waiveRaw.trim() || null
    );
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2 text-xs text-[var(--crm-foreground)] max-w-xs">
      <div className="text-[var(--crm-muted)]">
        <span className="font-medium text-[var(--crm-foreground)]">Status:</span>{" "}
        {v.status ?? "—"}
      </div>
      {a.confirmedAt && (
        <p className="text-[var(--crm-muted)]">
          Attested {new Date(a.confirmedAt).toLocaleString()}
          {a.followedHandles.length > 0 && (
            <span className="block mt-0.5">
              Handles: {a.followedHandles.map((h) => `@${h}`).join(", ")}
            </span>
          )}
        </p>
      )}
      {!a.confirmedAt && <p className="text-amber-700 dark:text-amber-400">No creator attestation yet</p>}
      <div className="flex flex-wrap gap-1.5 pt-1">
        <button
          type="button"
          disabled={loading}
          onClick={() => run("verified", { note })}
          className="rounded border border-[var(--crm-border)] bg-[var(--crm-bg)] px-2 py-1 text-[11px] font-medium hover:opacity-90 disabled:opacity-50"
        >
          Mark verified
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => run("pending")}
          className="rounded border border-[var(--crm-border)] bg-[var(--crm-bg)] px-2 py-1 text-[11px] font-medium hover:opacity-90 disabled:opacity-50"
        >
          Reset pending
        </button>
      </div>
      <div>
        <label className="block text-[var(--crm-muted)] mb-0.5">Note (optional, stored on verification)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded border border-[var(--crm-border)] bg-[var(--crm-card)] px-2 py-1 text-[11px]"
          placeholder="Reviewer note"
        />
      </div>
      <div>
        <label className="block text-[var(--crm-muted)] mb-0.5">Waive reason (required to waive)</label>
        <input
          value={waiveReason}
          onChange={(e) => setWaiveReason(e.target.value)}
          className="w-full rounded border border-[var(--crm-border)] bg-[var(--crm-card)] px-2 py-1 text-[11px]"
          placeholder="Why follow is waived"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => run("waived", { waiveReason: waiveReason.trim() })}
          className="mt-1 rounded border border-amber-600/40 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-[11px] font-medium text-amber-900 dark:text-amber-200 hover:opacity-90 disabled:opacity-50"
        >
          Waive follow requirement
        </button>
      </div>
      {error && <p className="text-red-600 text-[11px]" role="alert">{error}</p>}
    </div>
  );
}
