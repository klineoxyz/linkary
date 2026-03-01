/**
 * Single source of truth for mapping raw case study data to CaseStudyCard props.
 * Used by My Profile, Profile Edit, and (optionally) Public. No dependency on CaseStudyCard to avoid circular coupling.
 */

/** Output shape for CaseStudyCard (id, title, summary, tags, url, imageUrl, details). */
export type CaseStudyCardPropsOutput = {
  id: string;
  title: string | null;
  summary: string | null;
  tags?: string[];
  url: string | null;
  imageUrl?: string | null;
  details?: Record<string, unknown>;
};

/** Raw shape from DB / listCaseStudiesForProfile (Edit + My Profile). */
export type CaseStudyRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  proof_url?: string | null;
  proof_file_path?: string | null;
  metrics?: Record<string, unknown> | null;
  created_at?: string;
  is_public?: boolean;
  projectName?: string;
};

/** Public payload shape (already has summary, tags, url, imageUrl). */
export type CaseStudyPublicPayload = {
  id: string;
  title?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  url?: string | null;
  imageUrl?: string | null;
};

export function tagsFromMetrics(metrics: unknown): string[] {
  if (metrics == null || typeof metrics !== "object") return [];
  const m = metrics as Record<string, unknown>;
  const t = m.tags ?? m.tag;
  if (Array.isArray(t) && t.every((x) => typeof x === "string")) return t as string[];
  return [];
}

export function detailsFromMetrics(metrics: unknown): Record<string, unknown> | undefined {
  if (metrics == null || typeof metrics !== "object" || Array.isArray(metrics)) return undefined;
  const entries = Object.entries(metrics as Record<string, unknown>).filter(
    ([k, v]) => k !== "tags" && k !== "tag" && v != null && v !== ""
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Map raw case study (from any surface) to CaseStudyCard props.
 * My Profile & Edit: pass CaseStudyRow with includeDetails: true (no imageUrl for now).
 * Public: can pass CaseStudyPublicPayload with imageUrl already set in payload.
 */
export function toCaseStudyCardProps(
  row: CaseStudyRow | CaseStudyPublicPayload,
  options?: { imageUrl?: string | null; includeDetails?: boolean }
): CaseStudyCardPropsOutput {
  const isPayload = "summary" in row && "tags" in row;
  if (isPayload) {
    const p = row as CaseStudyPublicPayload;
    return {
      id: p.id,
      title: p.title ?? null,
      summary: p.summary ?? null,
      tags: p.tags ?? undefined,
      url: p.url ?? null,
      imageUrl: options?.imageUrl ?? p.imageUrl ?? null,
      details: undefined,
    };
  }
  const r = row as CaseStudyRow;
  const metrics = r.metrics;
  return {
    id: r.id,
    title: r.title ?? (r as { projectName?: string }).projectName ?? null,
    summary: r.description ?? null,
    tags: tagsFromMetrics(metrics),
    url: r.proof_url ?? null,
    imageUrl: options?.imageUrl ?? null,
    details: options?.includeDetails !== false ? detailsFromMetrics(metrics) : undefined,
  };
}
