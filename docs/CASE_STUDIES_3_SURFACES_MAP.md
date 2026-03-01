# Case Studies: 3 Surfaces Code Map + Unify Plan

## 1) Code locations and excerpts

---

### A) My Profile page (`/profile`)

**Files that render case studies, header media, links, reviews, hero**

| Surface        | File(s) | Notes |
|----------------|---------|--------|
| Case studies   | `apps/web/src/figma/app/App.tsx` | Inside `ProfilePage`, inside a `<Card>` |
| Hero / header  | Same file (profile section uses `MediaHeader`, hero may be in layout) |
| Links, reviews | Same file (other `<Card>` sections) |

**Data source and mapping**

- **Query/hook:** `listCaseStudiesForProfile(me.id)` in `useEffect` when `me?.id`; result stored in `caseStudies` state (`useState<any[]>`).
- **Display source:** `displayCaseStudies = caseStudies.length > 0 ? caseStudies : (u.caseStudies ?? [])` — so either real `CaseStudy[]` from API or demo `u.caseStudies`.
- **Location:** `App.tsx` ~3192–3196 (effect), ~3268 (displayCaseStudies), ~3501–3536 (Case Studies Card).

**Excerpt: data + list render (App.tsx)**

```tsx
// ~3195
useEffect(() => {
  if (me?.id) listCaseStudiesForProfile(me.id).then(setCaseStudies);
}, [me?.id]);

// ~3268
const displayCaseStudies = caseStudies.length > 0 ? caseStudies : (u.caseStudies ?? []);

// ~3502–3535 (Case Studies Card)
<Card>
  <div className="flex items-center justify-between mb-6">
    <h3 className="font-semibold text-foreground">Case Studies</h3>
    {isMyProfile && (
      <Button variant="outline" size="sm" ... onClick={() => setShowCaseStudyModal(true)}>Add New</Button>
    )}
    {!isMyProfile && caseStudies.length === 0 && u.caseStudies?.length === 0 && (
      <span className="text-xs font-medium text-foreground">No case studies yet</span>
    )}
  </div>
  <div className="space-y-3">
    {(displayCaseStudies ?? []).map((cs) => {
      const metrics = (cs as { metrics?: Record<string, unknown> }).metrics;
      const tags = /* from metrics.tags or metrics.tag */;
      const details = /* metrics minus tags/tag, non-empty */;
      return (
        <CaseStudyCard
          key={cs.id}
          id={cs.id}
          title={...}
          summary={...}
          tags={...}
          url={...}
          imageUrl={undefined}
          details={...}
        />
      );
    })}
  </div>
</Card>
```

**Surface summary (My Profile)**

- **List component:** `CaseStudyCard` from `@/components/public/CaseStudyCard`.
- **Fields passed:** `id`, `title`, `summary` (from `description` or `projectName`), `tags` (from `metrics.tags`/`tag`), `url` (from `proof_url`), `imageUrl={undefined}`, `details` (metrics minus tags).
- **Empty/CTAs:** “Add New” when `isMyProfile`; “No case studies yet” when not owner and both lists empty. No per-card actions.

---

### B) Profile Edit page (`/profile/edit` + `#case-studies`, `#header-media`, `#links`)

**Files**

| Area            | File | Notes |
|-----------------|------|--------|
| Edit page shell | `apps/web/src/figma/app/components/ProfileEditPage.tsx` | Renders sections by layout order |
| Case studies    | Same file: `CaseStudiesEditor` (~1014–1070) | List + “+ Add case study” |
| Case study modal| Same file: `CaseStudyModal` (~1132–1196) | Title, description, proof URL, is_public, optional image |
| PATCH           | `apps/web/src/app/api/case-studies/[id]/route.ts` | Updates title, description, proof_url, proof_file_path, is_public |

**Data source**

- **Query:** `listCaseStudiesForProfile(me.id)` — same as My Profile; data is `CaseStudy[]` from `@/lib/caseStudies` (id, title, description, proof_url, proof_file_path, metrics, created_at, is_public).
- **Reload:** After add/delete/edit or after image upload (`onImageSaved` → `loadCaseStudies`).

**Where proof_file_path, url, summary, tags, metrics are stored**

- **DB:** `case_studies.proof_file_path` (PATCH and media commit), `proof_url`, `description`, `metrics` (JSONB). Tags live inside `metrics` (e.g. `metrics.tags` or `metrics.tag`).
- **Modal form:** `caseStudyForm`: `title`, `description`, `proofUrl`, `is_public`. No `metrics` in form; modal does not edit tags/metrics.
- **PATCH body:** `title`, `description`, `proof_url`, `proof_file_path`, `is_public`. No `metrics` in PATCH.

**Excerpt: CaseStudiesEditor (ProfileEditPage.tsx ~1036–1068)**

```tsx
<ul className="space-y-3">
  {caseStudies.map((cs) => {
    const metricsForDetails = /* metrics minus tags/tag, non-empty */;
    return (
      <li key={cs.id}>
        <CaseStudyCard
          id={cs.id}
          title={cs.title ?? null}
          summary={cs.description ?? null}
          tags={tagsFromMetrics(cs.metrics)}
          url={cs.proof_url ?? null}
          imageUrl={undefined}
          actions={
            <div className="flex items-center gap-2">
              {!cs.is_public && <span className="text-xs text-zinc-500">Hidden</span>}
              <button ... onClick={() => onOpenEditModal(cs)}>Edit</button>
              <button ... onClick={() => remove(cs.id)}>Delete</button>
            </div>
          }
          details={metricsForDetails && Object.keys(metricsForDetails).length > 0 ? metricsForDetails : undefined}
        />
      </li>
    );
  })}
</ul>
```

**Excerpt: CaseStudyModal PATCH (ProfileEditPage.tsx ~2760–2778)**

```tsx
const res = await fetch(`${base}/api/case-studies/${editingCaseStudy.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify({
    title: caseStudyForm.title.trim() || null,
    description: caseStudyForm.description.trim() || null,
    proof_url: caseStudyForm.proofUrl.trim() || null,
    is_public: caseStudyForm.is_public,
  }),
});
```

**Surface summary (Edit)**

- **List component:** Same `CaseStudyCard`; list is inside `CaseStudiesEditor`.
- **Fields passed:** Same shape as My Profile plus `actions` (Edit, Delete, “Hidden” when not public) and `details` from metrics.
- **Empty/CTAs:** “+ Add case study”; empty list still shows the section. Modal has optional image (MediaUploadField `case_study_proof` → commits to `proof_file_path`).

---

### C) Public page (`/(public)/[username]`)

**Files**

| Area              | File | Notes |
|-------------------|------|--------|
| Payload + fetch   | `apps/web/src/app/(public)/[username]/page.tsx` | Server component: fetches profile, case_studies, links, reviews, hero, header_media, builds payload |
| Sections + gating | `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` | Receives `data` (incl. caseStudies, viewer_is_owner), renders sections by key |
| Card              | `apps/web/src/components/public/CaseStudyCard.tsx` | Single card UI |

**Payload build (page.tsx)**

- **Case studies query (~295):**  
  `serviceSupabase.from("case_studies").select("id, title, description, proof_url, proof_file_path, metrics, created_at").eq("owner_type","profile").eq("owner_profile_id", profileId).eq("is_public", true).order("created_at", { ascending: false }).limit(20)`
- **Mapping (~393–411):** For each row, `createSignedUrlForPath(serviceSupabase, proof_file_path)` → `imageUrl`; then  
  `{ id, title, summary: c.description, tags: tagsFromMetrics(c.metrics), url: c.proof_url, imageUrl }`.
- **viewer_is_owner (~220–224):** From `serverSupabase.auth.getUser()`; if `user?.id === profileId` then `viewer_is_owner = true`; passed in payload at ~612.

**Excerpt: page.tsx case studies mapping**

```ts
const { createSignedUrlForPath } = await import("@/lib/mediaSignedUrlServer");
const caseStudies = await Promise.all(
  caseStudiesList.map(async (c) => {
    let imageUrl: string | null = null;
    const path = (c as { proof_file_path?: string | null }).proof_file_path?.trim();
    if (path && !path.includes("..")) {
      const signed = await createSignedUrlForPath(serviceSupabase, path);
      imageUrl = signed ?? null;
    }
    return {
      id: c.id,
      title: c.title ?? null,
      summary: c.description ?? null,
      tags: tagsFromMetrics(c.metrics),
      url: c.proof_url ?? null,
      imageUrl,
    };
  })
);
```

**PublicProfileContent sections**

- **case_studies (~939–984):**  
  If `caseStudies.length === 0 && !viewerIsOwner` → return null. Else section with title “Case studies”; if empty and owner → CTA “Add proof card” link to `/profile/edit#case-studies`. Else list of `CaseStudyCard` with `id`, `title`, `summary`, `tags`, `url`, `imageUrl`.
- **links / reviews / header_media:** Same pattern: hide section when empty and not owner; when owner and empty show CTA.

**Excerpt: PublicProfileContent case_studies**

```tsx
case "case_studies": {
  if (caseStudies.length === 0 && !viewerIsOwner) return null;
  const sortedCaseStudies = featuredCaseStudyId ? [...caseStudies].sort(...) : caseStudies;
  return (
    <section ...>
      <div className={islandClass}>
        <SectionTitle>Case studies</SectionTitle>
        {sortedCaseStudies.length === 0 ? (
          <div ...>{/* empty state */}{viewerIsOwner && <Link href="/profile/edit#case-studies">Add proof card</Link>}</div>
        ) : (
          <ul className="grid ...">
            {sortedCaseStudies.map((c) => (
              <li key={c.id}>
                <CaseStudyCard id={c.id} title={c.title} summary={c.summary} tags={c.tags} url={c.url} imageUrl={(c as { imageUrl?: string | null }).imageUrl} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
```

**How imageUrl is signed**

- In `page.tsx`: for each case study row with `proof_file_path`, `createSignedUrlForPath(serviceSupabase, path)` is called (from `@/lib/mediaSignedUrlServer`). Result is passed as `imageUrl` in the payload. No client-side signing.

**viewer_is_owner gating**

- Set in `page.tsx`: `viewer_is_owner = (user?.id === profileId)`.
- Used in `PublicProfileContent`: `viewerIsOwner` controls (1) whether empty sections are hidden (visitor) or show CTA (owner), (2) whether “Add proof card” etc. are shown.

**Surface summary (Public)**

- **List component:** Same `CaseStudyCard`; no `actions`, no `details`.
- **Fields expected:** `id`, `title`, `summary`, `tags`, `url`, `imageUrl` (signed from `proof_file_path`).
- **Empty/CTAs:** Visitor: section not rendered if no case studies. Owner: empty state + “Add proof card” CTA.

---

## 2) Single source of truth: `toCaseStudyCardProps()`

**Goal:** One helper that turns “raw” case study shapes from any surface into the props needed by `CaseStudyCard`: `{ id, title, summary, tags, url, imageUrl?, details? }`. No DB or fetch changes; only mapping + props.

**Proposed location**

- `apps/web/src/lib/caseStudyCardProps.ts`  
  (or `apps/web/src/lib/caseStudies/toCaseStudyCardProps.ts` if you prefer a subfolder.)

**Proposed signature and types**

```ts
// apps/web/src/lib/caseStudyCardProps.ts

import type { CaseStudyCardProps } from "@/components/public/CaseStudyCard";

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
  projectName?: string; // demo/legacy
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

function tagsFromMetrics(metrics: unknown): string[] {
  if (metrics == null || typeof metrics !== "object") return [];
  const m = metrics as Record<string, unknown>;
  const t = m.tags ?? m.tag;
  if (Array.isArray(t) && t.every((x) => typeof x === "string")) return t as string[];
  return [];
}

function detailsFromMetrics(metrics: unknown): Record<string, unknown> | undefined {
  if (metrics == null || typeof metrics !== "object" || Array.isArray(metrics)) return undefined;
  const entries = Object.entries(metrics as Record<string, unknown>).filter(
    ([k, v]) => k !== "tags" && k !== "tag" && v != null && v !== ""
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Single source of truth: map raw case study (from any surface) to CaseStudyCard props.
 * Use for My Profile, Edit, and Public (public payload can be passed through with optional normalization).
 */
export function toCaseStudyCardProps(
  row: CaseStudyRow | CaseStudyPublicPayload,
  options?: { imageUrl?: string | null; includeDetails?: boolean }
): Pick<CaseStudyCardProps, "id" | "title" | "summary" | "tags" | "url" | "imageUrl" | "details"> {
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
```

- **Inputs:** Either DB/row shape (`CaseStudyRow`: id, title, description, proof_url, proof_file_path, metrics, etc.) or public payload shape (`CaseStudyPublicPayload`: id, title, summary, tags, url, imageUrl). Optional `options.imageUrl` to override (e.g. when signing on public). Optional `options.includeDetails` for Edit/My Profile.
- **Output:** `{ id, title, summary, tags, url, imageUrl, details }` matching `CaseStudyCard` (no `actions`; callers add that where needed).

---

## 3) Behavior rules (align without breaking)

- **Visibility**  
  - **Public:** Only `is_public = true` in the query. When `viewer_is_owner` is true, you could in future show all and label non-public as “Hidden” (today public page only fetches public; owner sees CTAs when empty).  
  - **My Profile:** Show all (from `listCaseStudiesForProfile`; no is_public filter).  
  - **Edit:** Show all; “Hidden” label when `is_public === false`.  

- **Empty states**  
  - **Public visitor:** Hide case studies section when empty (already: `if (caseStudies.length === 0 && !viewerIsOwner) return null`).  
  - **Public owner:** Show CTA (“Add proof card”).  
  - **My Profile:** Keep “Add New” and “No case studies yet” when not owner and both lists empty.  

- **Video**  
  - Hero vs header media: in `PublicProfileContent.tsx`, if hero is video and header_media is video and normalized URL (YouTube/Vimeo) is the same, hide header_media section. No autoplay.

---

## 4) Exact file list + minimal diff plan

**Exact files**

- `apps/web/src/figma/app/App.tsx` — My Profile case studies list.
- `apps/web/src/figma/app/components/ProfileEditPage.tsx` — CaseStudiesEditor, CaseStudyModal, tagsFromMetrics.
- `apps/web/src/app/(public)/[username]/page.tsx` — Payload build, case studies query, tagsFromMetrics, imageUrl signing.
- `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` — case_studies (and links/reviews/header_media) sections, viewerIsOwner.
- `apps/web/src/components/public/CaseStudyCard.tsx` — Card props (id, title, summary, tags, url, imageUrl, actions?, details?).
- `apps/web/src/lib/caseStudies.ts` — CaseStudy type, listCaseStudiesForProfile.
- `apps/web/src/app/api/case-studies/[id]/route.ts` — PATCH (proof_url, proof_file_path, etc.).

**What will change**

1. **Add** `apps/web/src/lib/caseStudyCardProps.ts`: implement `toCaseStudyCardProps`, `tagsFromMetrics`, `detailsFromMetrics`, and the two raw types.
2. **My Profile (App.tsx):** Replace inline mapping with `toCaseStudyCardProps(cs, { includeDetails: true })` and spread result + `id` into `<CaseStudyCard>`; remove local tags/details derivation.
3. **Edit (ProfileEditPage.tsx):** Replace inline `tagsFromMetrics`/details logic with `toCaseStudyCardProps(cs, { includeDetails: true })`; keep `tagsFromMetrics` in file only if still used elsewhere, or import from `caseStudyCardProps`. Pass `actions` as today.
4. **Public (page.tsx):** After building each `{ id, title, summary, tags, url, imageUrl }`, optionally normalize with `toCaseStudyCardProps(publicItem)` so the shape is always from one place (or keep current mapping and only use helper for the two other surfaces; either way types stay compatible).
5. **PublicProfileContent.tsx:** When rendering `<CaseStudyCard>`, pass props that match the output of `toCaseStudyCardProps` (or keep current spread; no schema/fetch change).

**What will not change**

- DB schema and RLS.
- Fetch logic: who calls `listCaseStudiesForProfile` or the public page query.
- Section order or preset logic.
- PATCH API or modal fields (title, description, proof_url, is_public, optional image).
- Platform-wide styling or new theme tokens.
- CaseStudyCard component API (already has id, title, summary, tags, url, imageUrl, actions?, details?).

This gives you one mapping layer used by all three surfaces and a minimal, low-risk diff focused on mapping + props only.
