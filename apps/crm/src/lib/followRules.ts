/**
 * Parse campaign follow_rules and evaluate submission-time follow requirement (no live X API calls).
 */

export type FollowRulesParsed = {
  requiresFollow: boolean;
  /** Normalized X handles without @, lowercase */
  mustFollowHandles: string[];
  notes?: string;
};

export type ParsedVerification = {
  status: "pending" | "verified" | "waived" | null;
};

export type ParsedAttestation = {
  confirmedAt: string | null;
  followedHandles: string[];
};

export function normalizeXHandleInput(s: string): string | null {
  const t = s.trim().replace(/^@/, "").toLowerCase();
  if (!t || !/^[a-z0-9_]{1,15}$/i.test(t)) return null;
  return t;
}

export function parseFollowRules(raw: unknown): FollowRulesParsed {
  if (!raw || typeof raw !== "object") {
    return { requiresFollow: false, mustFollowHandles: [] };
  }
  const o = raw as Record<string, unknown>;
  const requiresFollow =
    o.require_x_follow === true ||
    o.requires_x_follow === true ||
    o.requireXFollow === true;
  let handles: string[] = [];
  const mf = o.must_follow_handles ?? o.mustFollowHandles;
  if (Array.isArray(mf)) {
    handles = mf.map((h) => normalizeXHandleInput(String(h))).filter((x): x is string => Boolean(x));
  } else if (typeof mf === "string" && mf.trim()) {
    handles = mf
      .split(/[\s,\n]+/)
      .map((p) => normalizeXHandleInput(p))
      .filter((x): x is string => Boolean(x));
  }
  const uniq = [...new Set(handles)];
  const notes = typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : undefined;
  return { requiresFollow: Boolean(requiresFollow), mustFollowHandles: uniq, notes };
}

export function parseVerification(raw: unknown): ParsedVerification {
  if (!raw || typeof raw !== "object") return { status: null };
  const s = (raw as Record<string, unknown>).status;
  if (s === "verified" || s === "waived" || s === "pending") return { status: s };
  return { status: null };
}

export function parseAttestation(raw: unknown): ParsedAttestation {
  if (!raw || typeof raw !== "object") return { confirmedAt: null, followedHandles: [] };
  const o = raw as Record<string, unknown>;
  const confirmedAt =
    typeof o.confirmed_at === "string" && o.confirmed_at.trim() ? o.confirmed_at.trim() : null;
  const fh = o.followed_handles ?? o.followedHandles;
  let followedHandles: string[] = [];
  if (Array.isArray(fh)) {
    followedHandles = fh
      .map((h) => normalizeXHandleInput(String(h)))
      .filter((x): x is string => Boolean(x));
  }
  return { confirmedAt, followedHandles: [...new Set(followedHandles)] };
}

/**
 * Gate for the participant's first proof submission on this campaign (any submission row counts).
 */
export function evaluateFollowRequirementForFirstSubmission(input: {
  rules: FollowRulesParsed;
  attestation: unknown;
  verification: unknown;
}): { ok: true } | { ok: false; message: string } {
  if (!input.rules.requiresFollow) return { ok: true };

  const v = parseVerification(input.verification);
  if (v.status === "verified" || v.status === "waived") return { ok: true };

  const a = parseAttestation(input.attestation);
  if (!a.confirmedAt) {
    return {
      ok: false,
      message:
        "This campaign requires following the brand on X before your first proof submission. Save your follow confirmation below, or ask the campaign team to verify or waive this step.",
    };
  }

  if (input.rules.mustFollowHandles.length > 0) {
    const claimed = new Set(a.followedHandles);
    const missing = input.rules.mustFollowHandles.filter((h) => !claimed.has(h));
    if (missing.length > 0) {
      const list = missing.map((h) => `@${h}`).join(", ");
      return {
        ok: false,
        message: `List every required account you follow (${list}) in “Accounts you follow”, then save again before submitting proof.`,
      };
    }
  }

  return { ok: true };
}

export function parseHandlesFromUserInput(raw: string): string[] {
  const parts = raw
    .split(/[\n,]+/)
    .map((p) => normalizeXHandleInput(p))
    .filter((x): x is string => Boolean(x));
  return [...new Set(parts)];
}
