"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { updateMyProfile } from "@/lib/profiles";
import { getProfileProfessions, setProfileProfessions } from "@/lib/profileProfessions";
import { sanitizeUrl } from "@/lib/sanitizeUrl";
import { isPrivateStorageUrl } from "@/lib/isPrivateStorageUrl";
import { listCaseStudiesForProfile, createCaseStudyForProfile, type CaseStudy } from "@/lib/caseStudies";
import ProfessionSelect from "./ProfessionSelect";
import { MediaUploadField } from "@/components/MediaUploadField";
import { SignedMediaImage } from "@/components/SignedMediaImage";
import { CaseStudyCard } from "@/components/public/CaseStudyCard";
import { toCaseStudyCardProps } from "@/lib/caseStudyCardProps";
import type { Profession } from "@/lib/professions";
import type { Profile } from "@/lib/profiles";
import { PRESET_DEFAULT_ORDER, PRESET_DEFAULT_HIDDEN, SECTION_KEYS, type PresetName } from "@/lib/publicLayoutPresets";

type HeaderMediaType = "NONE" | "IMAGE" | "VIDEO";

type ProfileType = "individual" | "project" | "company";

type TeamMemberRow = {
  id: string;
  name: string;
  role: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  website_url: string | null;
  is_public: boolean;
  sort_order: number;
};

type ProfileLinkRow = {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type SkillRow = {
  id: string;
  name: string;
  level: number | null;
  is_public: boolean;
  sort_order: number;
  created_at?: string;
};

type AchievementRow = {
  id: string;
  title: string;
  description: string | null;
  url?: string | null;
  proof_url?: string | null;
  is_public: boolean;
  sort_order: number;
  created_at?: string;
};

type RelationType = "ambassador" | "affiliate" | "ecosystem" | "subsidiary";

type ProfileRelationRow = {
  id: string;
  source_profile_id: string;
  target_profile_id: string;
  relation_type: RelationType;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  target_profile?: { id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string } | null;
};

type PartnerRow = {
  id: string;
  owner_type: string;
  owner_id: string;
  program_type: "affiliate" | "ambassador";
  name: string;
  website_url: string | null;
  logo_url: string | null;
  logo_file_path: string | null;
  description: string | null;
  since_date: string | null;
  is_featured: boolean;
  sort_order: number;
  target_profile_id?: string | null;
  created_at: string;
  updated_at: string;
};

const GIG_TYPES = ["ambassador", "affiliate", "ugc", "marketing", "partnership", "other"] as const;
const COMP_TYPES = ["paid", "revshare", "token", "equity", "unpaid", "other"] as const;

type GigRow = {
  id: string;
  owner_profile_id: string;
  title: string;
  description: string;
  gig_type: string;
  compensation_type: string;
  budget_text: string | null;
  location: string | null;
  remote: boolean;
  is_public: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

type GigApplicationRow = {
  id: string;
  gig_id: string;
  applicant_profile_id: string;
  message: string | null;
  case_study_ids: string[];
  status: string;
  created_at: string;
  applicant?: { username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string };
  case_studies?: Array<{ id: string; title: string | null; proof_url: string | null }>;
};

const LOCATION_OPTIONS = [
  "",
  "Remote",
  "Europe",
  "Arabian Gulf",
  "North America",
  "South America",
  "Asia Pacific",
  "China",
  "Africa",
  "Other",
];

function PartnerProgramsEditor({
  me,
  partners,
  partnersLoading,
  onReload,
  getAuthHeaders,
  onOpenModal,
}: {
  me: Profile;
  partners: PartnerRow[];
  partnersLoading: boolean;
  onReload: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onOpenModal: (programType: "affiliate" | "ambassador", edit?: PartnerRow) => void;
}) {
  const [tab, setTab] = useState<"affiliate" | "ambassador">("affiliate");
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const list = partners.filter((p) => p.program_type === tab);
  const move = async (row: PartnerRow, direction: "up" | "down") => {
    const idx = list.findIndex((p) => p.id === row.id);
    if (idx < 0) return;
    const next = direction === "up" ? list[idx - 1] : list[idx + 1];
    if (!next) return;
    const headers = await getAuthHeaders();
    await fetch(`${base}/api/partners/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ sortOrder: next.sort_order }),
    });
    await fetch(`${base}/api/partners/${next.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ sortOrder: row.sort_order }),
    });
    onReload();
  };
  const remove = async (id: string) => {
    if (!confirm("Remove this partner?")) return;
    const headers = await getAuthHeaders();
    await fetch(`${base}/api/partners/${id}`, { method: "DELETE", headers });
    onReload();
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-zinc-700">Partner programs</label>
        <div className="flex gap-1">
          <button type="button" onClick={() => setTab("affiliate")} className={`px-2 py-1 rounded text-xs font-medium ${tab === "affiliate" ? "bg-primary text-white" : "bg-zinc-200 text-zinc-700"}`}>Affiliates</button>
          <button type="button" onClick={() => setTab("ambassador")} className={`px-2 py-1 rounded text-xs font-medium ${tab === "ambassador" ? "bg-primary text-white" : "bg-zinc-200 text-zinc-700"}`}>Ambassadors</button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">Shown on your public page under Partners &amp; programs.</p>
      {partnersLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <>
          <ul className="space-y-2">
            {list.map((p, idx) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2">
                {p.logo_file_path ? (
                  <SignedMediaImage path={p.logo_file_path} getAuthHeaders={getAuthHeaders} className="h-8 w-8 rounded object-cover shrink-0" />
                ) : p.logo_url && !isPrivateStorageUrl(p.logo_url) ? (
                  <img src={p.logo_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-zinc-900 truncate">{p.name}</div>
                  {p.description && <div className="text-xs text-zinc-500 truncate">{p.description}</div>}
                </div>
                {p.is_featured && <span className="shrink-0 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Featured</span>}
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => move(p, "up")} disabled={idx === 0} className="text-zinc-500 hover:text-zinc-700 text-xs px-1 disabled:opacity-50">↑</button>
                  <button type="button" onClick={() => move(p, "down")} disabled={idx === list.length - 1} className="text-zinc-500 hover:text-zinc-700 text-xs px-1 disabled:opacity-50">↓</button>
                  <button type="button" onClick={() => onOpenModal(tab, p)} className="text-xs text-primary hover:underline">Edit</button>
                  <button type="button" onClick={() => remove(p.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onOpenModal(tab)} className="text-sm text-primary font-medium hover:underline">
            + Add {tab === "affiliate" ? "affiliate" : "ambassador"}
          </button>
        </>
      )}
    </div>
  );
}

function LinksEditor({
  links,
  linksLoading,
  onReload,
  getAuthHeaders,
  onOpenModal,
  onOpenEditModal,
}: {
  links: ProfileLinkRow[];
  linksLoading: boolean;
  onReload: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onOpenModal: () => void;
  onOpenEditModal: (link: ProfileLinkRow) => void;
}) {
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const move = async (link: ProfileLinkRow, direction: "up" | "down") => {
    const idx = links.findIndex((l) => l.id === link.id);
    if (idx < 0) return;
    const next = direction === "up" ? links[idx - 1] : links[idx + 1];
    if (!next) return;
    const headers = await getAuthHeaders();
    const orderedIds = [...links].sort((a, b) => a.sort_order - b.sort_order).map((l) => l.id);
    const fromIdx = orderedIds.indexOf(link.id);
    const toIdx = orderedIds.indexOf(next.id);
    if (fromIdx < 0 || toIdx < 0) return;
    [orderedIds[fromIdx], orderedIds[toIdx]] = [orderedIds[toIdx], orderedIds[fromIdx]];
    await fetch(`${base}/api/profile/links/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ orderedIds }),
    });
    onReload();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this link?")) return;
    const headers = await getAuthHeaders();
    await fetch(`${base}/api/profile/links/${id}`, { method: "DELETE", headers });
    onReload();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground">Links (public profile)</label>
        <button type="button" onClick={onOpenModal} className="text-sm text-primary font-medium hover:underline">+ Add link</button>
      </div>
      <p className="text-xs text-muted-foreground">Shown on linkary.xyz/you. Only links marked public are visible.</p>
      {linksLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <ul className="space-y-2">
            {links.map((link, idx) => (
              <li key={link.id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                {link.icon ? (
                  <img src={link.icon} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-6 w-6 rounded bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">{link.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{link.url}</div>
                </div>
                {!link.is_public && <span className="shrink-0 text-xs text-muted-foreground">Hidden</span>}
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => move(link, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-foreground text-xs px-1 disabled:opacity-50">↑</button>
                  <button type="button" onClick={() => move(link, "down")} disabled={idx === links.length - 1} className="text-muted-foreground hover:text-foreground text-xs px-1 disabled:opacity-50">↓</button>
                  <button type="button" onClick={() => onOpenEditModal(link)} className="text-xs text-primary hover:underline">Edit</button>
                  <button type="button" onClick={() => remove(link.id)} className="text-xs text-destructive hover:underline">Delete</button>
                </div>
              </li>
            ))}
          </ul>
          {links.length === 0 && (
            <p className="text-sm text-muted-foreground">No links yet. Add links to show them on your public page.</p>
          )}
        </>
      )}
    </div>
  );
}

function LinkModal({
  edit,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  edit?: ProfileLinkRow | null;
  form: { title: string; url: string; icon: string; is_public: boolean };
  setForm: React.Dispatch<React.SetStateAction<{ title: string; url: string; icon: string; is_public: boolean }>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = form.title.trim().length >= 1 && form.title.trim().length <= 60
    && (form.url.trim().startsWith("https://") || form.url.trim().startsWith("http://"));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-lg max-w-md w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-foreground">{edit ? "Edit link" : "Add link"}</h3>
        <input type="text" placeholder="Title (1–60 chars)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" maxLength={60} />
        <input type="url" placeholder="URL (https:// or http://)" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
        <input type="text" placeholder="Icon URL (optional, max 32 chars)" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value.slice(0, 32) }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" maxLength={32} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
          <span className="text-sm text-foreground">Show on public profile</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-foreground bg-background">Cancel</button>
          <button type="button" disabled={!canSubmit || saving} onClick={onSubmit} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
            {saving ? "Saving…" : edit ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillsEditor({
  title,
  skills,
  skillsLoading,
  onReload,
  getAuthHeaders,
  onOpenModal,
  onOpenEditModal,
}: {
  title: string;
  skills: SkillRow[];
  skillsLoading: boolean;
  onReload: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onOpenModal: () => void;
  onOpenEditModal: (skill: SkillRow) => void;
}) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const sorted = [...skills].sort((a, b) => a.sort_order - b.sort_order);

  const move = async (skill: SkillRow, direction: "up" | "down") => {
    const idx = sorted.findIndex((s) => s.id === skill.id);
    if (idx < 0) return;
    const next = direction === "up" ? sorted[idx - 1] : sorted[idx + 1];
    if (!next) return;
    const headers = await getAuthHeaders();
    const orderedIds = sorted.map((s) => s.id);
    const fromIdx = orderedIds.indexOf(skill.id);
    const toIdx = orderedIds.indexOf(next.id);
    [orderedIds[fromIdx], orderedIds[toIdx]] = [orderedIds[toIdx], orderedIds[fromIdx]];
    await fetch(`${base}/api/profile/skills/reorder`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ orderedIds }) });
    onReload();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this skill?")) return;
    const headers = await getAuthHeaders();
    await fetch(`${base}/api/profile/skills/${id}`, { method: "DELETE", headers });
    onReload();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground">{title}</label>
        <button type="button" onClick={onOpenModal} className="text-sm text-primary font-medium hover:underline">+ Add</button>
      </div>
      <p className="text-xs text-muted-foreground">Shown on your public profile. Only items marked public are visible.</p>
      {skillsLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {sorted.map((skill, idx) => (
              <span key={skill.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
                <span className="font-medium text-foreground">{skill.name}</span>
                {skill.level != null && <span className="text-muted-foreground text-xs">({skill.level}/5)</span>}
                {!skill.is_public && <span className="text-xs text-muted-foreground">Hidden</span>}
                <button type="button" onClick={() => move(skill, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-foreground text-xs px-0.5 disabled:opacity-50">↑</button>
                <button type="button" onClick={() => move(skill, "down")} disabled={idx === sorted.length - 1} className="text-muted-foreground hover:text-foreground text-xs px-0.5 disabled:opacity-50">↓</button>
                <button type="button" onClick={() => onOpenEditModal(skill)} className="text-xs text-primary hover:underline">Edit</button>
                <button type="button" onClick={() => remove(skill.id)} className="text-xs text-destructive hover:underline">Delete</button>
              </span>
            ))}
          </div>
          {skills.length === 0 && <p className="text-sm text-muted-foreground">None yet. Add items to show on your public page.</p>}
        </>
      )}
    </div>
  );
}

function SkillModal({
  edit,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  edit?: SkillRow | null;
  form: { name: string; level: number | null; is_public: boolean };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; level: number | null; is_public: boolean }>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = form.name.trim().length >= 1 && form.name.trim().length <= 40;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-lg max-w-md w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-foreground">{edit ? "Edit skill" : "Add skill"}</h3>
        <input type="text" placeholder="Name (max 40 chars)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.slice(0, 40) }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" maxLength={40} />
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Level (optional, 1–5)</label>
          <select value={form.level ?? ""} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value === "" ? null : Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground">
            <option value="">None</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n} / 5</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
          <span className="text-sm text-foreground">Show on public profile</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-foreground bg-background">Cancel</button>
          <button type="button" disabled={!canSubmit || saving} onClick={onSubmit} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : edit ? "Update" : "Add"}</button>
        </div>
      </div>
    </div>
  );
}

function AchievementsEditor({
  achievements,
  achievementsLoading,
  onReload,
  getAuthHeaders,
  onOpenModal,
  onOpenEditModal,
}: {
  achievements: AchievementRow[];
  achievementsLoading: boolean;
  onReload: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onOpenModal: () => void;
  onOpenEditModal: (a: AchievementRow) => void;
}) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const sorted = [...achievements].sort((a, b) => a.sort_order - b.sort_order);

  const move = async (item: AchievementRow, direction: "up" | "down") => {
    const idx = sorted.findIndex((a) => a.id === item.id);
    if (idx < 0) return;
    const next = direction === "up" ? sorted[idx - 1] : sorted[idx + 1];
    if (!next) return;
    const headers = await getAuthHeaders();
    const orderedIds = sorted.map((a) => a.id);
    const fromIdx = orderedIds.indexOf(item.id);
    const toIdx = orderedIds.indexOf(next.id);
    [orderedIds[fromIdx], orderedIds[toIdx]] = [orderedIds[toIdx], orderedIds[fromIdx]];
    await fetch(`${base}/api/profile/achievements/reorder`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ orderedIds }) });
    onReload();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this achievement?")) return;
    const headers = await getAuthHeaders();
    await fetch(`${base}/api/profile/achievements/${id}`, { method: "DELETE", headers });
    onReload();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground">Achievements</label>
        <button type="button" onClick={onOpenModal} className="text-sm text-primary font-medium hover:underline">+ Add</button>
      </div>
      <p className="text-xs text-muted-foreground">Shown on your public profile. Only items marked public are visible.</p>
      {achievementsLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <ul className="space-y-2">
            {sorted.map((a, idx) => (
              <li key={a.id} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{a.title}</div>
                  {a.description && <div className="text-xs text-muted-foreground line-clamp-2">{a.description}</div>}
                  {(a.url ?? a.proof_url) && <div className="text-xs text-primary truncate">{(a.url ?? a.proof_url) as string}</div>}
                  {!a.is_public && <span className="text-xs text-muted-foreground">Hidden</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => move(a, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-foreground text-xs px-1 disabled:opacity-50">↑</button>
                  <button type="button" onClick={() => move(a, "down")} disabled={idx === sorted.length - 1} className="text-muted-foreground hover:text-foreground text-xs px-1 disabled:opacity-50">↓</button>
                  <button type="button" onClick={() => onOpenEditModal(a)} className="text-xs text-primary hover:underline">Edit</button>
                  <button type="button" onClick={() => remove(a.id)} className="text-xs text-destructive hover:underline">Delete</button>
                </div>
              </li>
            ))}
          </ul>
          {achievements.length === 0 && <p className="text-sm text-muted-foreground">None yet. Add achievements to show on your public page.</p>}
        </>
      )}
    </div>
  );
}

function AchievementModal({
  edit,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  edit?: AchievementRow | null;
  form: { title: string; description: string; url: string; is_public: boolean };
  setForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; url: string; is_public: boolean }>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = form.title.trim().length >= 1 && form.title.trim().length <= 80;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-lg max-w-md w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-foreground">{edit ? "Edit achievement" : "Add achievement"}</h3>
        <input type="text" placeholder="Title (max 80 chars) *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value.slice(0, 80) }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" maxLength={80} />
        <textarea placeholder="Description (optional, max 280 chars)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value.slice(0, 280) }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground resize-none" maxLength={280} />
        <input type="url" placeholder="URL (optional, https:// or http://)" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
          <span className="text-sm text-foreground">Show on public profile</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-foreground bg-background">Cancel</button>
          <button type="button" disabled={!canSubmit || saving} onClick={onSubmit} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : edit ? "Update" : "Add"}</button>
        </div>
      </div>
    </div>
  );
}

function RelationsEditor({
  relations,
  relationsLoading,
  profileType,
  onReload,
  getAuthHeaders,
  onOpenAddModal,
  onOpenEditModal,
  setError,
}: {
  relations: ProfileRelationRow[];
  relationsLoading: boolean;
  profileType: ProfileType;
  onReload: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onOpenAddModal: (relationType: RelationType) => void;
  onOpenEditModal: (r: ProfileRelationRow) => void;
  setError: (s: string | null) => void;
}) {
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const byType = (type: RelationType) => relations.filter((r) => r.relation_type === type).sort((a, b) => a.sort_order - b.sort_order);

  const move = async (rel: ProfileRelationRow, direction: "up" | "down") => {
    const list = byType(rel.relation_type);
    const idx = list.findIndex((r) => r.id === rel.id);
    if (idx < 0) return;
    const next = direction === "up" ? list[idx - 1] : list[idx + 1];
    if (!next) return;
    const headers = await getAuthHeaders();
    const orderedIds = list.map((r) => r.id);
    const fromIdx = orderedIds.indexOf(rel.id);
    const toIdx = orderedIds.indexOf(next.id);
    if (fromIdx < 0 || toIdx < 0) return;
    [orderedIds[fromIdx], orderedIds[toIdx]] = [orderedIds[toIdx], orderedIds[fromIdx]];
    const res = await fetch(`${base}/api/profile/relations/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ relationType: rel.relation_type, orderedIds }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.message ?? "Reorder failed");
    else onReload();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this relation?")) return;
    const headers = await getAuthHeaders();
    const res = await fetch(`${base}/api/profile/relations/${id}`, { method: "DELETE", headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.message ?? "Delete failed");
    else onReload();
  };

  const renderList = (type: RelationType, title: string) => {
    const list = byType(type);
    return (
      <div key={type} className="mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <label className="text-sm font-medium text-zinc-700">{title}</label>
          <button type="button" onClick={() => onOpenAddModal(type)} className="text-sm text-primary font-medium hover:underline">+ Add</button>
        </div>
        <ul className="space-y-2">
          {list.map((r, idx) => (
            <li key={r.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2">
              {r.target_profile?.avatar_url ? (
                <img src={r.target_profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-zinc-200 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-zinc-900 truncate">{r.target_profile?.display_name || r.target_profile?.username || r.target_profile_id}</div>
                {r.target_profile && <div className="text-xs text-zinc-500">@{r.target_profile.username}</div>}
              </div>
              {!r.is_public && <span className="shrink-0 text-xs text-zinc-500">Hidden</span>}
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => move(r, "up")} disabled={idx === 0} className="text-zinc-500 hover:text-zinc-700 text-xs px-1 disabled:opacity-50">↑</button>
                <button type="button" onClick={() => move(r, "down")} disabled={idx === list.length - 1} className="text-zinc-500 hover:text-zinc-700 text-xs px-1 disabled:opacity-50">↓</button>
                <button type="button" onClick={() => onOpenEditModal(r)} className="text-xs text-primary hover:underline">Edit</button>
                <button type="button" onClick={() => remove(r.id)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="text-sm text-zinc-500">None yet</p>}
      </div>
    );
  };

  if (profileType === "individual") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
        <label className="block text-sm font-medium text-zinc-700">Relations</label>
        <p className="text-xs text-zinc-500 mb-3">Ambassador of / Affiliate of (projects or companies).</p>
        {relationsLoading ? <p className="text-sm text-zinc-500">Loading…</p> : (
          <>
            {renderList("ambassador", "Ambassador of")}
            {renderList("affiliate", "Affiliate of")}
          </>
        )}
      </div>
    );
  }
  if (profileType === "project") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
        <label className="block text-sm font-medium text-zinc-700">Relations</label>
        <p className="text-xs text-zinc-500 mb-3">Ambassadors, affiliates, ecosystem projects, subsidiaries.</p>
        {relationsLoading ? <p className="text-sm text-zinc-500">Loading…</p> : (
          <>
            {renderList("ambassador", "Ambassadors")}
            {renderList("affiliate", "Affiliates")}
            {renderList("ecosystem", "Ecosystem projects")}
            {renderList("subsidiary", "Subsidiaries")}
          </>
        )}
      </div>
    );
  }
  if (profileType === "company") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
        <label className="block text-sm font-medium text-zinc-700">Relations</label>
        <p className="text-xs text-zinc-500 mb-3">Ambassadors, affiliates, subsidiaries.</p>
        {relationsLoading ? <p className="text-sm text-zinc-500">Loading…</p> : (
          <>
            {renderList("ambassador", "Ambassadors")}
            {renderList("affiliate", "Affiliates")}
            {renderList("subsidiary", "Subsidiaries")}
          </>
        )}
      </div>
    );
  }
  return null;
}

function RelationModal({
  relationType,
  edit,
  selectedTarget,
  form,
  setForm,
  searchQuery,
  searchResults,
  searchLoading,
  onSearch,
  onSelectTarget,
  onClose,
  onSubmit,
  saving,
}: {
  relationType: RelationType;
  edit?: ProfileRelationRow | null;
  selectedTarget: { id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string } | null;
  form: { is_public: boolean };
  setForm: React.Dispatch<React.SetStateAction<{ is_public: boolean }>>;
  searchQuery: string;
  searchResults: Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string }>;
  searchLoading: boolean;
  onSearch: (q: string) => void;
  onSelectTarget: (p: { id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string } | null) => void;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const typeLabel = relationType === "ambassador" ? "Ambassador" : relationType === "affiliate" ? "Affiliate" : relationType === "ecosystem" ? "Ecosystem" : "Subsidiary";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-zinc-900">{edit ? "Edit" : "Add"} {typeLabel}</h3>
        {!edit && (
          <>
            <input
              type="text"
              placeholder="Search profiles (username, name…)"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900"
            />
            {searchLoading && <p className="text-xs text-zinc-500">Searching…</p>}
            {searchResults.length > 0 && (
              <ul className="max-h-40 overflow-y-auto space-y-1 border border-zinc-200 rounded-lg p-2">
                {searchResults.filter((p) => p.username).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTarget({ id: p.id, username: p.username!, display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null, profile_type: typeof p.profile_type === "string" ? p.profile_type : "individual" })}
                      className="w-full flex items-center gap-2 rounded p-2 text-left hover:bg-zinc-100"
                    >
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full bg-zinc-200" />}
                      <span className="font-medium truncate">{p.display_name || p.username || p.id}</span>
                      <span className="text-xs text-zinc-500">@{p.username || ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedTarget && (
              <p className="text-sm text-zinc-600">Selected: {selectedTarget.display_name || selectedTarget.username}</p>
            )}
          </>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
          <span className="text-sm text-zinc-700">Show on public profile</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700">Cancel</button>
          <button
            type="button"
            disabled={saving || (!edit && !selectedTarget)}
            onClick={onSubmit}
            className="px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : edit ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamEditor({
  me,
  profileType,
  team,
  teamLoading,
  onReload,
  getAuthHeaders,
  onOpenModal,
  onOpenEditModal,
}: {
  me: Profile;
  profileType: ProfileType;
  team: TeamMemberRow[];
  teamLoading: boolean;
  onReload: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onOpenModal: () => void;
  onOpenEditModal: (m: TeamMemberRow) => void;
}) {
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const move = async (member: TeamMemberRow, direction: "up" | "down") => {
    const idx = team.findIndex((t) => t.id === member.id);
    if (idx < 0) return;
    const next = direction === "up" ? team[idx - 1] : team[idx + 1];
    if (!next) return;
    const headers = await getAuthHeaders();
    const orderedIds = [...team].sort((a, b) => a.sort_order - b.sort_order).map((t) => t.id);
    const fromIdx = orderedIds.indexOf(member.id);
    const toIdx = orderedIds.indexOf(next.id);
    if (fromIdx < 0 || toIdx < 0) return;
    [orderedIds[fromIdx], orderedIds[toIdx]] = [orderedIds[toIdx], orderedIds[fromIdx]];
    await fetch(`${base}/api/org-team/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ orderedIds }),
    });
    onReload();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    const headers = await getAuthHeaders();
    await fetch(`${base}/api/org-team/${id}`, { method: "DELETE", headers });
    onReload();
  };

  if (profileType !== "company") return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-zinc-700">Team</label>
        <button type="button" onClick={onOpenModal} className="text-sm text-primary font-medium hover:underline">+ Add member</button>
      </div>
      <p className="text-xs text-zinc-500">Shown on your public company profile. Only members marked public are visible.</p>
      {teamLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <>
          <ul className="space-y-2">
            {team.map((m, idx) => (
              <li key={m.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-zinc-200 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-zinc-900 truncate">{m.name}</div>
                  {m.role && <div className="text-xs text-zinc-500 truncate">{m.role}</div>}
                </div>
                {!m.is_public && <span className="shrink-0 text-xs text-zinc-500">Hidden</span>}
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => move(m, "up")} disabled={idx === 0} className="text-zinc-500 hover:text-zinc-700 text-xs px-1 disabled:opacity-50">↑</button>
                  <button type="button" onClick={() => move(m, "down")} disabled={idx === team.length - 1} className="text-zinc-500 hover:text-zinc-700 text-xs px-1 disabled:opacity-50">↓</button>
                  <button type="button" onClick={() => onOpenEditModal(m)} className="text-xs text-primary hover:underline">Edit</button>
                  <button type="button" onClick={() => remove(m.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </li>
            ))}
          </ul>
          {team.length === 0 && (
            <p className="text-sm text-zinc-500">No team members yet. Add members to show them on your public page.</p>
          )}
        </>
      )}
    </div>
  );
}

function TeamMemberModal({
  edit,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  edit?: TeamMemberRow | null;
  form: { name: string; role: string; avatar_url: string; linkedin_url: string; x_url: string; website_url: string; is_public: boolean };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; role: string; avatar_url: string; linkedin_url: string; x_url: string; website_url: string; is_public: boolean }>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-zinc-900">{edit ? "Edit team member" : "Add team member"}</h3>
        <input type="text" placeholder="Name (required)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="text" placeholder="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="url" placeholder="Avatar URL" value={form.avatar_url} onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="url" placeholder="LinkedIn URL" value={form.linkedin_url} onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="url" placeholder="X (Twitter) URL" value={form.x_url} onChange={(e) => setForm((f) => ({ ...f, x_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="url" placeholder="Website URL" value={form.website_url} onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
          <span className="text-sm text-zinc-700">Show on public profile</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700">Cancel</button>
          <button type="button" disabled={!form.name.trim() || saving} onClick={onSubmit} className="px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-50">
            {saving ? "Saving…" : edit ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GigsEditor({
  me,
  gigs,
  gigsLoading,
  onReload,
  getAuthHeaders,
  onOpenGigModal,
  onOpenApplications,
  setError,
}: {
  me: Profile | null;
  gigs: GigRow[];
  gigsLoading: boolean;
  onReload: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onOpenGigModal: (edit?: GigRow) => void;
  onOpenApplications: (gigId: string) => void;
  setError: (s: string | null) => void;
}) {
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const closeGig = async (id: string) => {
    if (!confirm("Close this gig? It will no longer accept applications.")) return;
    const headers = await getAuthHeaders();
    const res = await fetch(`${base}/api/gigs/${id}/close`, { method: "POST", headers });
    if (res.ok) onReload();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.message ?? "Failed to close");
    }
  };

  const deleteGig = async (id: string) => {
    if (!confirm("Delete this gig? This cannot be undone.")) return;
    const headers = await getAuthHeaders();
    const res = await fetch(`${base}/api/gigs/${id}`, { method: "DELETE", headers });
    if (res.ok) onReload();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.message ?? "Failed to delete");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground">Gigs</label>
        <button type="button" onClick={() => onOpenGigModal()} className="text-sm text-primary font-medium hover:underline">+ Create gig</button>
      </div>
      <p className="text-xs text-muted-foreground">Public opportunities. Only project/company profiles can create gigs.</p>
      {gigsLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : gigs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gigs yet. Create one to accept applications.</p>
      ) : (
        <ul className="space-y-2">
          {gigs.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate">{g.title}</div>
                <div className="flex flex-wrap gap-1.5 mt-1 text-xs text-muted-foreground">
                  <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 capitalize">{g.gig_type}</span>
                  <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 capitalize">{g.compensation_type}</span>
                  <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5">{g.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => onOpenApplications(g.id)} className="text-xs text-primary hover:underline">Applications</button>
                <button type="button" onClick={() => onOpenGigModal(g)} className="text-xs text-primary hover:underline">Edit</button>
                {g.status === "open" && (
                  <button type="button" onClick={() => closeGig(g.id)} className="text-xs text-muted-foreground hover:underline">Close</button>
                )}
                <button type="button" onClick={() => deleteGig(g.id)} className="text-xs text-destructive hover:underline">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CaseStudiesEditor({
  me,
  caseStudies,
  signedImageUrlsByPath,
  onReload,
  onOpenAddModal,
  onOpenEditModal,
  setError,
}: {
  me: Profile;
  caseStudies: CaseStudy[];
  signedImageUrlsByPath?: Record<string, string | null>;
  onReload: () => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (cs: CaseStudy) => void;
  setError: (s: string | null) => void;
}) {
  const remove = async (id: string) => {
    if (!confirm("Remove this case study?")) return;
    const { error } = await supabase.from("case_studies").delete().eq("id", id).eq("owner_profile_id", me.id);
    if (error) setError(error.message);
    else onReload();
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-zinc-700">Case studies</label>
        <button type="button" onClick={onOpenAddModal} className="text-sm text-primary font-medium hover:underline">+ Add case study</button>
      </div>
      <p className="text-xs text-zinc-500">Proof and outcomes shown on your public page.</p>
      <ul className="space-y-3">
        {caseStudies.map((cs) => {
          const imageUrl = cs.proof_file_path?.trim() ? (signedImageUrlsByPath?.[cs.proof_file_path] ?? null) : null;
          const props = toCaseStudyCardProps(cs, { includeDetails: true, imageUrl });
          return (
            <li key={cs.id}>
              <CaseStudyCard
                {...props}
                actions={
                  <div className="flex items-center gap-2">
                    {!cs.is_public && <span className="text-xs text-zinc-500">Hidden</span>}
                    <button type="button" onClick={() => onOpenEditModal(cs)} className="text-xs text-primary hover:underline">Edit</button>
                    <button type="button" onClick={() => remove(cs.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type PartnerFormState = {
  name: string;
  websiteUrl: string;
  logoUrl: string;
  description: string;
  sinceDate: string;
  isFeatured: boolean;
  targetProfileId: string | null;
};

type SearchProfileResult = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile_type?: string;
  twitter_username?: string | null;
  website?: string | null;
};

function PartnerModal({
  programType,
  edit,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
  getAuthHeaders,
  onLogoSaved,
  partners,
}: {
  programType: "affiliate" | "ambassador";
  edit?: PartnerRow;
  partners: PartnerRow[];
  form: PartnerFormState;
  setForm: React.Dispatch<React.SetStateAction<PartnerFormState>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: { name: string; websiteUrl?: string | null; logoUrl?: string | null; description?: string | null; sinceDate?: string | null; isFeatured?: boolean }) => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onLogoSaved?: () => void;
}) {
  const currentEdit = edit ? (partners.find((p) => p.id === edit.id) ?? edit) : undefined;
  const [partnerSearchQuery, setPartnerSearchQuery] = useState("");
  const [partnerSearchResults, setPartnerSearchResults] = useState<SearchProfileResult[]>([]);
  const [partnerSearchLoading, setPartnerSearchLoading] = useState(false);
  const [linkedProfileDisplay, setLinkedProfileDisplay] = useState<SearchProfileResult | { id: string; display_name: null; username: null; twitter_username?: null } | null>(null);

  useEffect(() => {
    if (edit?.target_profile_id) {
      setLinkedProfileDisplay({ id: edit.target_profile_id, display_name: null, username: null, twitter_username: null });
    } else {
      setLinkedProfileDisplay(null);
    }
  }, [edit?.target_profile_id]);

  useEffect(() => {
    const q = partnerSearchQuery.trim();
    if (q.length < 2) {
      setPartnerSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setPartnerSearchLoading(true);
      try {
        const headers = await getAuthHeaders();
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${base}/api/search/profiles?q=${encodeURIComponent(q)}`, { headers });
        const json = await res.json().catch(() => ({}));
        const list = Array.isArray(json?.profiles) ? json.profiles as SearchProfileResult[] : [];
        setPartnerSearchResults(list);
      } catch {
        setPartnerSearchResults([]);
      } finally {
        setPartnerSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [partnerSearchQuery, getAuthHeaders]);

  const onSelectProfile = (profile: SearchProfileResult) => {
    setLinkedProfileDisplay(profile);
    setForm((f) => ({
      ...f,
      targetProfileId: profile.id,
      name: profile.display_name?.trim() || profile.username?.trim() || f.name,
      websiteUrl: profile.website?.trim() || f.websiteUrl,
    }));
    setPartnerSearchQuery("");
    setPartnerSearchResults([]);
  };

  const onRemoveLink = () => {
    setLinkedProfileDisplay(null);
    setForm((f) => ({ ...f, targetProfileId: null }));
  };

  const linkLabel = linkedProfileDisplay
    ? (linkedProfileDisplay.display_name?.trim() || linkedProfileDisplay.username?.trim() || "Linked profile")
    : (form.targetProfileId ? "Linked profile" : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-zinc-900">{edit ? "Edit" : "Add"} {programType}</h3>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Search project by name or X handle</label>
          <input
            type="text"
            placeholder="Type name or @handle…"
            value={partnerSearchQuery}
            onChange={(e) => setPartnerSearchQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900"
          />
          {partnerSearchLoading && <p className="text-xs text-zinc-500 mt-1">Searching…</p>}
          {partnerSearchResults.length > 0 && (
            <ul className="mt-2 border border-zinc-200 rounded-lg divide-y divide-zinc-100 max-h-40 overflow-y-auto">
              {partnerSearchResults.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectProfile(p)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 text-zinc-900"
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-zinc-200 shrink-0 flex items-center justify-center text-xs font-medium text-zinc-600">
                        {(p.display_name || p.username || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="font-medium truncate block">{p.display_name || p.username || "—"}</span>
                      <span className="text-xs text-zinc-500">
                        {p.username ? `@${p.username}` : ""}
                        {p.twitter_username ? (p.username ? ` · @${p.twitter_username}` : `@${p.twitter_username}`) : ""}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {linkLabel && (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <span className="text-sm text-zinc-700">Linked to: {linkLabel}</span>
            <button type="button" onClick={onRemoveLink} className="text-xs text-primary hover:underline ml-auto">Remove link</button>
          </div>
        )}

        <input type="text" placeholder="Name (required)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="url" placeholder="Website URL" value={form.websiteUrl} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        {currentEdit ? (
          <MediaUploadField label="Logo" type="partner_logo" ownerId={currentEdit.id} value={currentEdit.logo_file_path ?? null} onChange={() => {}} getAuthHeaders={getAuthHeaders} onSaved={onLogoSaved} accept="image/*" maxSizeMB={2} />
        ) : (
          <p className="text-xs text-zinc-500">Save the partner first, then edit to add a logo (file upload).</p>
        )}
        <textarea placeholder="Description (max 280 chars)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value.slice(0, 280) }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="date" placeholder="Since date" value={form.sinceDate} onChange={(e) => setForm((f) => ({ ...f, sinceDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} />
          <span className="text-sm text-zinc-700">Featured</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700">Cancel</button>
          <button type="button" disabled={!form.name.trim() || saving} onClick={() => onSubmit({ name: form.name.trim(), websiteUrl: form.websiteUrl.trim() || null, logoUrl: null, description: form.description.trim() || null, sinceDate: form.sinceDate.trim() || null, isFeatured: form.isFeatured })} className="px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-50">
            {saving ? "Saving…" : edit ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CaseStudyModal({
  edit,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
  getAuthHeaders,
  onImageSaved,
}: {
  edit?: CaseStudy | null;
  form: { title: string; description: string; proofUrl: string; is_public: boolean };
  setForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; proofUrl: string; is_public: boolean }>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onImageSaved?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-zinc-900">{edit ? "Edit case study" : "Add case study"}</h3>
        <input type="text" placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Proof URL</label>
          <input
            type="url"
            placeholder="https://… link to evidence (article, tweet, etc.)"
            value={form.proofUrl}
            onChange={(e) => setForm((f) => ({ ...f, proofUrl: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900"
          />
        </div>
        {edit && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Image (optional)</label>
            <MediaUploadField
              label=""
              type="case_study_proof"
              ownerId={edit.id}
              value={edit.proof_file_path ?? null}
              onChange={() => {}}
              getAuthHeaders={getAuthHeaders}
              onSaved={onImageSaved}
              accept="image/*"
              maxSizeMB={2}
            />
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
          <span className="text-sm text-zinc-700">Show on public profile</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700">Cancel</button>
          <button type="button" disabled={saving} onClick={onSubmit} className="px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-50">{saving ? "Saving…" : edit ? "Update" : "Add"}</button>
        </div>
      </div>
    </div>
  );
}

export default function ProfileEditPage({
  setRoute,
  me,
  onSaved,
}: {
  setRoute: (r: { name: string }) => void;
  me: Profile | null;
  onSaved?: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [headerMediaType, setHeaderMediaType] = useState<HeaderMediaType>("NONE");
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [headerMediaFilePath, setHeaderMediaFilePath] = useState<string | null>(null);
  const [xUrl, setXUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [showReviews, setShowReviews] = useState(true);
  const [tokenDexscreenerUrl, setTokenDexscreenerUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnerModal, setPartnerModal] = useState<{ open: true; programType: "affiliate" | "ambassador"; edit?: PartnerRow } | { open: false }>({ open: false });
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [signedCaseStudyUrlsByPath, setSignedCaseStudyUrlsByPath] = useState<Record<string, string | null>>({});
  const signPathsCacheRef = useRef<Record<string, Record<string, string | null>>>({});
  const lastSignPathsKeyRef = useRef<string | null>(null);
  const [caseStudyModal, setCaseStudyModal] = useState(false);
  const [editingCaseStudy, setEditingCaseStudy] = useState<CaseStudy | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [partnerForm, setPartnerForm] = useState({ name: "", websiteUrl: "", logoUrl: "", description: "", sinceDate: "", isFeatured: false, targetProfileId: null as string | null });
  const [caseStudyForm, setCaseStudyForm] = useState({ title: "", description: "", proofUrl: "", is_public: true });
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [caseStudySaving, setCaseStudySaving] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvDeleting, setCvDeleting] = useState(false);
  const [profileType, setProfileType] = useState<ProfileType>("individual");
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroVideoUrl, setHeroVideoUrl] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [publicLayoutPreset, setPublicLayoutPreset] = useState<"classic" | "spotlight" | "showcase" | "compact">("classic");
  const [layoutOrder, setLayoutOrder] = useState<string[]>(["proof", "token", "team", "gigs", "relations", "skills", "achievements", "case_studies", "links", "reviews"]);
  const [layoutHidden, setLayoutHidden] = useState<Record<string, boolean>>({});
  const [featuredCaseStudyId, setFeaturedCaseStudyId] = useState<string | null>(null);
  const [featuredReviewId, setFeaturedReviewId] = useState<string | null>(null);
  const [featuredGigId, setFeaturedGigId] = useState<string | null>(null);
  const [myReviews, setMyReviews] = useState<Array<{ id: string; rating: number; title: string | null; body: string | null; created_at: string }>>([]);
  const [team, setTeam] = useState<TeamMemberRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamModal, setTeamModal] = useState<{ open: true; edit?: TeamMemberRow } | { open: false }>({ open: false });
  const [teamForm, setTeamForm] = useState({ name: "", role: "", avatar_url: "", linkedin_url: "", x_url: "", website_url: "", is_public: true });
  const [teamSaving, setTeamSaving] = useState(false);
  const [links, setLinks] = useState<ProfileLinkRow[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linkModal, setLinkModal] = useState<{ open: true; edit?: ProfileLinkRow } | { open: false }>({ open: false });
  const [linkForm, setLinkForm] = useState({ title: "", url: "", icon: "", is_public: true });
  const [linkSaving, setLinkSaving] = useState(false);
  const [relations, setRelations] = useState<ProfileRelationRow[]>([]);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [relationModal, setRelationModal] = useState<{ open: true; relationType: RelationType; edit?: ProfileRelationRow } | { open: false }>({ open: false });
  const [relationForm, setRelationForm] = useState({ is_public: true });
  const [relationSaving, setRelationSaving] = useState(false);
  const [relationSearchQuery, setRelationSearchQuery] = useState("");
  const [relationSearchResults, setRelationSearchResults] = useState<Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string }>>([]);
  const [relationSearchLoading, setRelationSearchLoading] = useState(false);
  const [selectedRelationTarget, setSelectedRelationTarget] = useState<{ id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string } | null>(null);
  const [heroMode, setHeroMode] = useState<"none" | "image" | "video">("none");
  const [myGigs, setMyGigs] = useState<GigRow[]>([]);
  const [gigsLoading, setGigsLoading] = useState(false);
  const [gigModal, setGigModal] = useState<{ open: true; edit?: GigRow } | { open: false }>({ open: false });
  const [gigForm, setGigForm] = useState({
    title: "",
    description: "",
    gig_type: "ambassador",
    compensation_type: "paid",
    budget_text: "",
    location: "",
    remote: true,
    is_public: true,
  });
  const [gigSaving, setGigSaving] = useState(false);
  const [applicationsGigId, setApplicationsGigId] = useState<string | null>(null);
  const [applicationsList, setApplicationsList] = useState<GigApplicationRow[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationStatusSaving, setApplicationStatusSaving] = useState<string | null>(null);
  const [dealCreatedNote, setDealCreatedNote] = useState(false);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillModal, setSkillModal] = useState<{ open: true; edit?: SkillRow } | { open: false }>({ open: false });
  const [skillForm, setSkillForm] = useState({ name: "", level: null as number | null, is_public: true });
  const [skillSaving, setSkillSaving] = useState(false);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [achievementModal, setAchievementModal] = useState<{ open: true; edit?: AchievementRow } | { open: false }>({ open: false });
  const [achievementForm, setAchievementForm] = useState({ title: "", description: "", url: "", is_public: true });
  const [achievementSaving, setAchievementSaving] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadPartners = useCallback(async () => {
    if (!me?.id) return;
    setPartnersLoading(true);
    try {
      const headers = await getAuthHeaders();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/partners?ownerType=profile&ownerId=${encodeURIComponent(me.id)}`, { headers });
      const json = await res.json().catch(() => ({}));
      if (json.ok && Array.isArray(json.partners)) setPartners(json.partners);
      else setPartners([]);
    } catch {
      setPartners([]);
    } finally {
      setPartnersLoading(false);
    }
  }, [me?.id, getAuthHeaders]);

  const loadCaseStudies = useCallback(async () => {
    if (!me?.id) return;
    const list = await listCaseStudiesForProfile(me.id);
    setCaseStudies(list);
    const paths = list
      .map((c) => c.proof_file_path?.trim())
      .filter((p): p is string => !!p && !p.includes(".."))
      .slice(0, 20);
    if (paths.length === 0) {
      lastSignPathsKeyRef.current = null;
      setSignedCaseStudyUrlsByPath({});
      return;
    }
    const pathsKey = paths.slice(0, 20).sort().join("|");
    const cached = signPathsCacheRef.current[pathsKey];
    if (cached !== undefined) {
      setSignedCaseStudyUrlsByPath(cached);
      return;
    }
    if (lastSignPathsKeyRef.current === pathsKey) return;
    lastSignPathsKeyRef.current = pathsKey;
    try {
      const headers = await getAuthHeaders();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/media/sign-case-study-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ paths }),
      });
      const json = await res.json().catch(() => ({}));
      const urlsByPath = json.urlsByPath && typeof json.urlsByPath === "object" ? json.urlsByPath as Record<string, string | null> : {};
      signPathsCacheRef.current[pathsKey] = urlsByPath;
      setSignedCaseStudyUrlsByPath(urlsByPath);
    } catch {
      setSignedCaseStudyUrlsByPath({});
    }
  }, [me?.id, getAuthHeaders]);

  const loadGigs = useCallback(async () => {
    if (!me?.id) return;
    setGigsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/gigs/mine`, { headers });
      const json = await res.json().catch(() => ({}));
      if (json.ok && Array.isArray(json.gigs)) setMyGigs(json.gigs);
      else setMyGigs([]);
    } catch {
      setMyGigs([]);
    } finally {
      setGigsLoading(false);
    }
  }, [me?.id, getAuthHeaders]);

  const loadMyReviews = useCallback(async () => {
    if (!me?.id) return;
    const { data } = await supabase
      .from("reviews")
      .select("id, rating, title, body, created_at")
      .eq("reviewee_type", "profile")
      .eq("reviewee_profile_id", me.id)
      .eq("verified_deal", true)
      .order("created_at", { ascending: false })
      .limit(50);
    setMyReviews((data as Array<{ id: string; rating: number; title: string | null; body: string | null; created_at: string }>) ?? []);
  }, [me?.id]);

  const loadApplications = useCallback(async (gigId: string) => {
    const headers = await getAuthHeaders();
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setApplicationsLoading(true);
    try {
      const res = await fetch(`${base}/api/gigs/${gigId}/applications`, { headers });
      const json = await res.json().catch(() => ({}));
      if (json.ok && Array.isArray(json.applications)) setApplicationsList(json.applications);
      else setApplicationsList([]);
    } catch {
      setApplicationsList([]);
    } finally {
      setApplicationsLoading(false);
    }
  }, [getAuthHeaders]);

  const loadTeam = useCallback(async () => {
    if (!me?.id) return;
    setTeamLoading(true);
    try {
      const headers = await getAuthHeaders();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/org-team?profileId=${encodeURIComponent(me.id)}`, { headers });
      const json = await res.json().catch(() => ({}));
      if (json.ok && Array.isArray(json.team)) setTeam(json.team as TeamMemberRow[]);
      else setTeam([]);
    } catch {
      setTeam([]);
    } finally {
      setTeamLoading(false);
    }
  }, [me?.id, getAuthHeaders]);

  const loadLinks = useCallback(async () => {
    if (!me?.id) return;
    setLinksLoading(true);
    try {
      const headers = await getAuthHeaders();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/profile/links`, { headers });
      const json = await res.json().catch(() => ({}));
      if (json.ok && Array.isArray(json.links)) setLinks(json.links as ProfileLinkRow[]);
      else setLinks([]);
    } catch {
      setLinks([]);
    } finally {
      setLinksLoading(false);
    }
  }, [me?.id, getAuthHeaders]);

  const loadSkills = useCallback(async () => {
    if (!me?.id) return;
    setSkillsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/profile/skills`, { headers });
      const json = await res.json().catch(() => ({}));
      if (json.ok && Array.isArray(json.skills)) setSkills(json.skills as SkillRow[]);
      else setSkills([]);
    } catch {
      setSkills([]);
    } finally {
      setSkillsLoading(false);
    }
  }, [me?.id, getAuthHeaders]);

  const loadAchievements = useCallback(async () => {
    if (!me?.id) return;
    setAchievementsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/profile/achievements`, { headers });
      const json = await res.json().catch(() => ({}));
      if (json.ok && Array.isArray(json.achievements)) {
        setAchievements((json.achievements as Array<AchievementRow & { url?: string | null }>).map((a) => ({ ...a, url: a.url ?? a.proof_url ?? null })));
      } else setAchievements([]);
    } catch {
      setAchievements([]);
    } finally {
      setAchievementsLoading(false);
    }
  }, [me?.id, getAuthHeaders]);

  const loadRelations = useCallback(async () => {
    if (!me?.id) return;
    setRelationsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/profile/relations`, { headers });
      const json = await res.json().catch(() => ({}));
      if (json.ok && Array.isArray(json.relations)) setRelations(json.relations as ProfileRelationRow[]);
      else setRelations([]);
    } catch {
      setRelations([]);
    } finally {
      setRelationsLoading(false);
    }
  }, [me?.id, getAuthHeaders]);

  const load = useCallback(async () => {
    if (!me?.id) return;
    setLoading(true);
    const [profResult, mediaData, socialsData, profileExt] = await Promise.all([
      getProfileProfessions(me.id),
      supabase.from("profile_media").select("header_media_type, header_media_url, header_media_file_path").eq("profile_id", me.id).maybeSingle(),
      supabase.from("profile_socials").select("x_url, linkedin_url, youtube_url, website_url, telegram_url").eq("profile_id", me.id).maybeSingle(),
      supabase.from("profiles").select("profile_type, hero_image_url, hero_video_url, hero_title, token_dexscreener_url, public_layout").eq("id", me.id).maybeSingle(),
    ]);
    loadPartners();
    loadCaseStudies();
    loadLinks();
    loadRelations();
    if (profileExt?.data) {
      const p = profileExt.data as {
        profile_type?: string;
        hero_image_url?: string | null;
        hero_video_url?: string | null;
        hero_title?: string | null;
        token_dexscreener_url?: string | null;
        public_layout?: { preset?: string; order?: string[]; hidden?: string[]; featured_case_study_id?: string | null; featured_review_id?: string | null; featured_gig_id?: string | null } | null;
      };
      if (p.profile_type === "project" || p.profile_type === "company") {
        setProfileType(p.profile_type as ProfileType);
        loadGigs();
      } else setProfileType("individual");
      setHeroImageUrl(p.hero_image_url ?? null);
      setHeroVideoUrl((p.hero_video_url ?? "") || "");
      setHeroTitle((p.hero_title ?? "") || "");
      setTokenDexscreenerUrl((p.token_dexscreener_url ?? "") || "");
      setHeroMode(p.hero_image_url ? "image" : (p.hero_video_url ?? "").trim() ? "video" : "none");
      const preset = p.public_layout?.preset;
      if (preset === "spotlight" || preset === "showcase" || preset === "compact") setPublicLayoutPreset(preset);
      else setPublicLayoutPreset("classic");
      const presetName: PresetName = preset === "spotlight" || preset === "showcase" || preset === "compact" ? preset : "classic";
      const order = Array.isArray(p.public_layout?.order) && p.public_layout.order.length > 0 ? [...p.public_layout.order] : [...PRESET_DEFAULT_ORDER[presetName]];
      for (const k of SECTION_KEYS) { if (!order.includes(k)) order.push(k); }
      setLayoutOrder(order);
      if (Array.isArray(p.public_layout?.hidden)) setLayoutHidden(Object.fromEntries((p.public_layout.hidden as string[]).map((k) => [k, true])));
      setFeaturedCaseStudyId(p.public_layout?.featured_case_study_id ?? null);
      setFeaturedReviewId(p.public_layout?.featured_review_id ?? null);
      setFeaturedGigId(p.public_layout?.featured_gig_id ?? null);
      loadMyReviews();
    }
    setLoading(false);
    if (me.display_name != null) setDisplayName(me.display_name);
    if (me.email != null) setEmail(me.email);
    if (me.bio != null) setBio(me.bio);
    if (me.website != null) setWebsite(me.website);
    if (me.location != null) setLocation(me.location);
    if (profResult?.data?.length) setProfessions(profResult.data);
    if (mediaData?.data) {
      const t = mediaData.data.header_media_type as HeaderMediaType;
      setHeaderMediaType(t === "IMAGE" || t === "VIDEO" ? t : "NONE");
      setHeaderMediaUrl(mediaData.data.header_media_url ?? "");
      setHeaderMediaFilePath((mediaData.data as { header_media_file_path?: string | null }).header_media_file_path ?? null);
    }
    if (socialsData?.data) {
      const s = socialsData.data as { x_url?: string | null; linkedin_url?: string | null; youtube_url?: string | null; website_url?: string | null; telegram_url?: string | null };
      setXUrl(s.x_url ?? "");
      setLinkedinUrl(s.linkedin_url ?? "");
      setYoutubeUrl(s.youtube_url ?? "");
      setTelegramUrl(s.telegram_url ?? "");
    }
    if (me?.published != null) setPublished(!!me.published);
    if ((me as { show_reviews?: boolean })?.show_reviews !== undefined) setShowReviews((me as { show_reviews: boolean }).show_reviews !== false);
    if ((me as { cv_document_id?: string | null })?.cv_document_id) {
      const { data: cvDoc } = await supabase
        .from("profile_documents")
        .select("file_name")
        .eq("id", (me as { cv_document_id: string }).cv_document_id)
        .eq("profile_id", me.id)
        .maybeSingle();
      setCvFileName((cvDoc as { file_name?: string } | null)?.file_name ?? "CV.pdf");
    } else {
      setCvFileName(null);
    }
    if ((profileExt?.data as { profile_type?: string } | null)?.profile_type === "company") {
      loadTeam();
    }
    loadSkills();
    loadAchievements();
  }, [me?.id, me?.display_name, me?.email, me?.bio, me?.website, me?.location, me?.published, (me as { cv_document_id?: string | null })?.cv_document_id, loadPartners, loadCaseStudies, loadTeam, loadGigs, loadLinks, loadSkills, loadAchievements, loadRelations, loadMyReviews]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!partnerModal.open) return;
    const edit = "edit" in partnerModal ? partnerModal.edit : undefined;
    if (edit) {
      setPartnerForm({
        name: edit.name,
        websiteUrl: edit.website_url ?? "",
        logoUrl: edit.logo_url ?? "",
        description: edit.description ?? "",
        sinceDate: edit.since_date ?? "",
        isFeatured: edit.is_featured,
        targetProfileId: edit.target_profile_id ?? null,
      });
    } else {
      setPartnerForm({ name: "", websiteUrl: "", logoUrl: "", description: "", sinceDate: "", isFeatured: false, targetProfileId: null });
    }
  }, [partnerModal]);

  useEffect(() => {
    if (!teamModal.open) return;
    const edit = teamModal.open && "edit" in teamModal ? teamModal.edit : undefined;
    if (edit) {
      setTeamForm({
        name: edit.name,
        role: edit.role ?? "",
        avatar_url: edit.avatar_url ?? "",
        linkedin_url: edit.linkedin_url ?? "",
        x_url: edit.x_url ?? "",
        website_url: edit.website_url ?? "",
        is_public: edit.is_public,
      });
    } else {
      setTeamForm({ name: "", role: "", avatar_url: "", linkedin_url: "", x_url: "", website_url: "", is_public: true });
    }
  }, [teamModal]);

  useEffect(() => {
    if (!linkModal.open) return;
    const edit = linkModal.open && "edit" in linkModal ? linkModal.edit : undefined;
    if (edit) {
      setLinkForm({
        title: edit.title,
        url: edit.url,
        icon: edit.icon ?? "",
        is_public: edit.is_public,
      });
    } else {
      setLinkForm({ title: "", url: "", icon: "", is_public: true });
    }
  }, [linkModal]);

  useEffect(() => {
    if (!relationModal.open || !relationSearchQuery.trim() || relationSearchQuery.length < 2) {
      setRelationSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setRelationSearchLoading(true);
      try {
        const headers = await getAuthHeaders();
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${base}/api/search/profiles?q=${encodeURIComponent(relationSearchQuery)}`, { headers });
        const json = await res.json().catch(() => ({}));
        if (json.ok && Array.isArray(json.profiles)) setRelationSearchResults(json.profiles);
        else setRelationSearchResults([]);
      } catch {
        setRelationSearchResults([]);
      } finally {
        setRelationSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [relationModal.open, relationSearchQuery, getAuthHeaders]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.id) return;
    setError(null);
    setSaving(true);
    let effectiveHeroImageUrl: string | null = null;
    let effectiveHeroVideoUrl: string | null = null;
    if (heroMode === "video") {
      const videoTrim = heroVideoUrl.trim();
      if (videoTrim.startsWith("https://")) effectiveHeroVideoUrl = videoTrim;
    } else if (heroMode === "image" && heroImageUrl?.trim()) {
      effectiveHeroImageUrl = heroImageUrl.trim();
    }
    const effectiveHeroTitle = heroTitle.trim() || null;

    const { error: profileErr } = await updateMyProfile(me.id, {
      display_name: displayName.trim() || null,
      email: email.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
      location: location.trim() || null,
      profile_type: profileType,
      hero_image_url: effectiveHeroImageUrl,
      hero_video_url: effectiveHeroVideoUrl,
      hero_title: effectiveHeroTitle,
      token_dexscreener_url: profileType === "project"
        ? (tokenDexscreenerUrl.trim().startsWith("https://") && tokenDexscreenerUrl.trim().includes("dexscreener.com/") ? tokenDexscreenerUrl.trim() : null)
        : null,
      public_layout_preset: publicLayoutPreset,
      public_layout_order: layoutOrder,
      public_layout_hidden: Object.keys(layoutHidden).filter((k) => layoutHidden[k]),
      featured_case_study_id: featuredCaseStudyId,
      featured_review_id: featuredReviewId,
      featured_gig_id: featuredGigId,
    });
    if (profileErr) {
      setSaving(false);
      setError(profileErr);
      return;
    }
    const { error: profErr } = await setProfileProfessions(me.id, professions.map((p) => p.id));
    if (profErr) {
      setSaving(false);
      setError(profErr);
      return;
    }
    let effectiveMediaType = headerMediaType;
    let effectiveMediaUrl: string | null = headerMediaType === "VIDEO" ? headerMediaUrl.trim() || null : null;
    let effectiveMediaFilePath: string | null = headerMediaType === "IMAGE" ? headerMediaFilePath : null;
    if (effectiveMediaUrl) {
      const sanitized = sanitizeUrl(effectiveMediaUrl);
      if (!sanitized) {
        effectiveMediaUrl = null;
        if (headerMediaType === "VIDEO") effectiveMediaType = "NONE";
      } else {
        effectiveMediaUrl = sanitized;
      }
    }
    const [mediaRes, socialsRes] = await Promise.all([
      supabase.from("profile_media").upsert(
        {
          profile_id: me.id,
          header_media_type: effectiveMediaType,
          header_media_url: effectiveMediaUrl,
          header_media_file_path: effectiveMediaFilePath,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      ),
      supabase.from("profile_socials").upsert(
        {
          profile_id: me.id,
          x_url: xUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          youtube_url: youtubeUrl.trim() || null,
          website_url: website.trim() || null,
          telegram_url: telegramUrl.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      ),
    ]);
    setSaving(false);
    if (mediaRes.error) {
      setError(mediaRes.error.message);
      return;
    }
    if (socialsRes.error) {
      setError(socialsRes.error.message);
      return;
    }
    setToast("Saved");
    setTimeout(() => setToast(null), 3000);
    onSaved?.();
    setRoute({ name: "profile" });
  };

  if (!me) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <p className="text-zinc-600">Sign in to edit your profile.</p>
        <button
          type="button"
          onClick={() => setRoute({ name: "login" })}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <button
        type="button"
        onClick={() => setRoute({ name: "profile" })}
        className="text-sm text-zinc-500 hover:text-zinc-700 mb-6"
      >
        ← Back to profile
      </button>
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Public 1-Pager</h1>
      <p className="text-zinc-600 text-sm mb-6">Control what appears on your public page (linkary.xyz/{me.username || "you"}).</p>

      {toast && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
          <p className="text-xs text-zinc-500 mb-2">Contact email (stored in your profile). Other users can have their own.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Short bio"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Social links</label>
          <p className="text-xs text-zinc-500 mb-2">Shown on your public profile.</p>
          <div className="space-y-2">
            <input
              type="url"
              value={xUrl}
              onChange={(e) => setXUrl(e.target.value)}
              placeholder="X (Twitter) URL"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="LinkedIn URL"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="YouTube URL"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
            <input
              type="url"
              value={telegramUrl}
              onChange={(e) => setTelegramUrl(e.target.value)}
              placeholder="Telegram URL"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Location (region)</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
          >
            {LOCATION_OPTIONS.map((opt) => (
              <option key={opt || "empty"} value={opt}>{opt || "Select…"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Profile type</label>
          <p className="text-xs text-zinc-500 mb-2">Determines which sections appear on your public page. Company profiles can show a Team section.</p>
          <select
            value={profileType}
            onChange={(e) => {
              const v = e.target.value as ProfileType;
              setProfileType(v);
              if (v === "company") loadTeam();
              if (v === "project" || v === "company") loadGigs();
            }}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
          >
            <option value="individual">Individual</option>
            <option value="project">Project</option>
            <option value="company">Company</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Public page layout</label>
          <p className="text-xs text-zinc-500 mb-2">How your public page is arranged. Classic = two columns; Spotlight = single column; Showcase = larger case studies &amp; gigs; Compact = denser.</p>
          <select
            value={publicLayoutPreset}
            onChange={(e) => setPublicLayoutPreset(e.target.value as "classic" | "spotlight" | "showcase" | "compact")}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
          >
            <option value="classic">Classic (2 columns)</option>
            <option value="spotlight">Spotlight (single column)</option>
            <option value="showcase">Showcase (featured cards)</option>
            <option value="compact">Compact (denser)</option>
          </select>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
          <label className="block text-sm font-medium text-zinc-700">Featured on public page</label>
          <p className="text-xs text-zinc-500 mb-2">Highlight one case study, one review, or (for projects/companies) one gig at the top of your public profile. Compact layout does not show featured.</p>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Featured case study</label>
              <div className="flex gap-2">
                <select
                  value={featuredCaseStudyId ?? ""}
                  onChange={(e) => setFeaturedCaseStudyId(e.target.value || null)}
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-sm"
                >
                  <option value="">None</option>
                  {caseStudies.filter((c) => c.is_public !== false).map((c) => (
                    <option key={c.id} value={c.id}>{c.title || c.id.slice(0, 8)}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setFeaturedCaseStudyId(null)} className="px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-600 text-sm hover:bg-zinc-50">Clear</button>
              </div>
            </div>
            {(profileType === "project" || profileType === "company") && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Featured gig</label>
                <div className="flex gap-2">
                  <select
                    value={featuredGigId ?? ""}
                    onChange={(e) => setFeaturedGigId(e.target.value || null)}
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-sm"
                  >
                    <option value="">None</option>
                    {myGigs.filter((g) => g.status === "open" && g.is_public).map((g) => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setFeaturedGigId(null)} className="px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-600 text-sm hover:bg-zinc-50">Clear</button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Featured review</label>
              <div className="flex gap-2">
                <select
                  value={featuredReviewId ?? ""}
                  onChange={(e) => setFeaturedReviewId(e.target.value || null)}
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 text-sm"
                >
                  <option value="">None</option>
                  {myReviews.map((r) => (
                    <option key={r.id} value={r.id}>{r.title || `${r.rating}★ · ${r.created_at.slice(0, 10)}`}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setFeaturedReviewId(null)} className="px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-600 text-sm hover:bg-zinc-50">Clear</button>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
          <label className="block text-sm font-medium text-zinc-700">Section order &amp; visibility</label>
          <p className="text-xs text-zinc-500 mb-2">Reorder sections and hide sections you don&apos;t want on your public page.</p>
          <button
            type="button"
            onClick={async () => {
              const preset = publicLayoutPreset as PresetName;
              const order = PRESET_DEFAULT_ORDER[preset];
              const hidden = PRESET_DEFAULT_HIDDEN[preset];
              setLayoutOrder([...order]);
              setLayoutHidden(Object.fromEntries(hidden.map((k) => [k, true])));
              if (me?.id) {
                await updateMyProfile(me.id, {
                  public_layout_order: order,
                  public_layout_hidden: hidden,
                });
              }
            }}
            className="mb-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Reset to preset defaults
          </button>
          <ul className="space-y-1">
            {layoutOrder.map((key, i) => {
              const label = key.replace(/_/g, " ");
              const hidden = layoutHidden[key];
              const moveUp = () => {
                const o = [...layoutOrder];
                if (i > 0) { const prev = i - 1; [o[prev], o[i]] = [o[i], o[prev]]; setLayoutOrder(o); }
              };
              const moveDown = () => {
                const o = [...layoutOrder];
                if (i < o.length - 1) { const next = i + 1; [o[i], o[next]] = [o[next], o[i]]; setLayoutOrder(o); }
              };
              return (
                <li key={key} className="flex items-center gap-2 py-1.5">
                  <button type="button" onClick={moveUp} className="px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-600 text-xs disabled:opacity-50" disabled={i === 0} title="Move up">↑</button>
                  <button type="button" onClick={moveDown} className="px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-600 text-xs disabled:opacity-50" disabled={i === layoutOrder.length - 1} title="Move down">↓</button>
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input type="checkbox" checked={!hidden} onChange={() => setLayoutHidden((h) => ({ ...h, [key]: !h[key] }))} className="rounded border-zinc-300" />
                    <span className={`text-sm capitalize ${hidden ? "text-zinc-400" : "text-zinc-700"}`}>{label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {(layoutHidden["header"] && layoutHidden["proof"] && layoutHidden["action_bar"]) && (
            <p className="mt-2 text-xs text-amber-600">Hiding header, proof, and action bar may make your profile look empty above the fold. Consider showing at least one.</p>
          )}
        </div>
        {profileType === "project" && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
            <label className="block text-sm font-medium text-zinc-700">Token</label>
            <p className="text-xs text-zinc-500 mb-2">Paste a Dexscreener pair URL to show a token price card on your public page.</p>
            <input
              type="url"
              value={tokenDexscreenerUrl}
              onChange={(e) => setTokenDexscreenerUrl(e.target.value)}
              placeholder="https://dexscreener.com/ethereum/0x..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
            {tokenDexscreenerUrl.trim() && (!tokenDexscreenerUrl.trim().startsWith("https://") || !tokenDexscreenerUrl.trim().includes("dexscreener.com/")) && (
              <p className="text-xs text-amber-600">URL must start with https:// and contain dexscreener.com/</p>
            )}
          </div>
        )}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
          <label className="block text-sm font-medium text-zinc-700">Hero (public profile top)</label>
          <p className="text-xs text-zinc-500 mb-2">Optional banner at the top of your public page. Use either an image (upload) or a video URL (e.g. YouTube), not both.</p>
          <select
            value={heroMode}
            onChange={(e) => {
              const v = e.target.value as "none" | "image" | "video";
              setHeroMode(v);
              if (v === "image") setHeroVideoUrl("");
              else if (v === "video") setHeroImageUrl(null);
              else {
                setHeroImageUrl(null);
                setHeroVideoUrl("");
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 mb-2"
          >
            <option value="none">None</option>
            <option value="image">Upload image</option>
            <option value="video">Paste video URL</option>
          </select>
          {heroMode !== "none" && (
            <>
              {heroMode === "image" && me?.id && (
                <MediaUploadField
                  label="Hero image"
                  type="profile_hero"
                  ownerId={me.id}
                  value={heroImageUrl}
                  onChange={(path) => {
                    setHeroImageUrl(path);
                    setHeroVideoUrl("");
                  }}
                  accept="image/*"
                  maxSizeMB={5}
                  getAuthHeaders={getAuthHeaders}
                  onSaved={() => load()}
                  className="mt-2"
                />
              )}
              {heroMode === "video" && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Video URL (must start with https://)</label>
                  <input
                    type="url"
                    value={heroVideoUrl}
                    onChange={(e) => setHeroVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/..."
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
                  />
                  {heroVideoUrl.trim() && !heroVideoUrl.trim().startsWith("https://") && (
                    <p className="text-xs text-amber-600 mt-1">URL must start with https://</p>
                  )}
                </div>
              )}
              <div className="mt-2">
                <label className="block text-xs font-medium text-zinc-600 mb-1">Hero title (optional)</label>
                <input
                  type="text"
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  placeholder="Short title or caption"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
                />
              </div>
            </>
          )}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
          <label className="block text-sm font-medium text-zinc-700">CV (PDF)</label>
          <p className="text-xs text-zinc-500">Upload a PDF to share with organizations when you apply to jobs (if you enable &quot;Share CV on applications&quot; in Privacy).</p>
          {cvFileName ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-zinc-700 truncate">{cvFileName}</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                id="cv-replace-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !me?.id) return;
                  e.target.value = "";
                  if (file.type !== "application/pdf") {
                    setError("Only PDF files are allowed.");
                    return;
                  }
                  setCvUploading(true);
                  setError(null);
                  try {
                    const headers = await getAuthHeaders();
                    const base = typeof window !== "undefined" ? window.location.origin : "";
                    const urlRes = await fetch(`${base}/api/profile/cv/upload-url`, { method: "POST", headers: { ...headers } });
                    const urlJson = await urlRes.json();
                    if (!urlRes.ok || !urlJson.uploadUrl || !urlJson.file_path) {
                      setError(urlJson.error || "Failed to get upload URL");
                      return;
                    }
                    const putRes = await fetch(urlJson.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": "application/pdf" } });
                    if (!putRes.ok) {
                      setError("Upload failed");
                      return;
                    }
                    const commitRes = await fetch(`${base}/api/profile/cv/commit`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...headers },
                      body: JSON.stringify({ file_path: urlJson.file_path, file_name: file.name, size_bytes: file.size }),
                    });
                    const commitJson = await commitRes.json();
                    if (!commitRes.ok || !commitJson.ok) {
                      setError(commitJson.error || "Failed to save CV");
                      return;
                    }
                    setCvFileName(file.name);
                    onSaved?.();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    setCvUploading(false);
                  }
                }}
              />
              <label htmlFor="cv-replace-input" className={`text-sm text-primary cursor-pointer hover:underline ${cvUploading ? "opacity-50 pointer-events-none" : ""}`}>
                {cvUploading ? "Uploading…" : "Replace"}
              </label>
              <button
                type="button"
                disabled={cvDeleting}
                onClick={async () => {
                  if (!me?.id || !confirm("Remove your CV?")) return;
                  setCvDeleting(true);
                  setError(null);
                  try {
                    const headers = await getAuthHeaders();
                    const base = typeof window !== "undefined" ? window.location.origin : "";
                    const res = await fetch(`${base}/api/profile/cv/delete`, { method: "POST", headers: { ...headers } });
                    const json = await res.json();
                    if (!res.ok && !json.ok) setError(json.error || "Delete failed");
                    else { setCvFileName(null); onSaved?.(); }
                  } finally {
                    setCvDeleting(false);
                  }
                }}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                {cvDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                id="cv-upload-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !me?.id) return;
                  e.target.value = "";
                  if (file.type !== "application/pdf") {
                    setError("Only PDF files are allowed.");
                    return;
                  }
                  setCvUploading(true);
                  setError(null);
                  try {
                    const headers = await getAuthHeaders();
                    const base = typeof window !== "undefined" ? window.location.origin : "";
                    const urlRes = await fetch(`${base}/api/profile/cv/upload-url`, { method: "POST", headers: { ...headers } });
                    const urlJson = await urlRes.json();
                    if (!urlRes.ok || !urlJson.uploadUrl || !urlJson.file_path) {
                      setError(urlJson.error || "Failed to get upload URL");
                      return;
                    }
                    const putRes = await fetch(urlJson.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": "application/pdf" } });
                    if (!putRes.ok) {
                      setError("Upload failed");
                      return;
                    }
                    const commitRes = await fetch(`${base}/api/profile/cv/commit`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...headers },
                      body: JSON.stringify({ file_path: urlJson.file_path, file_name: file.name, size_bytes: file.size }),
                    });
                    const commitJson = await commitRes.json();
                    if (!commitRes.ok || !commitJson.ok) {
                      setError(commitJson.error || "Failed to save CV");
                      return;
                    }
                    setCvFileName(file.name);
                    onSaved?.();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    setCvUploading(false);
                  }
                }}
              />
              <label htmlFor="cv-upload-input" className="inline-block px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-700 text-sm font-medium cursor-pointer hover:bg-zinc-50">
                {cvUploading ? "Uploading…" : "Upload PDF"}
              </label>
            </>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Header media (home &amp; public page)</label>
          <p className="text-xs text-zinc-500 mb-2">Optional header image (upload) or embed video URL (YouTube/Vimeo only; not an uploaded file) for your overview and public profile.</p>
          <select
            value={headerMediaType}
            onChange={(e) => setHeaderMediaType(e.target.value as HeaderMediaType)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 mb-2"
          >
            <option value="NONE">None</option>
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
          </select>
          {headerMediaType === "IMAGE" && me?.id && (
            <MediaUploadField
              label="Header image"
              type="profile_header"
              ownerId={me.id}
              value={headerMediaFilePath}
              onChange={setHeaderMediaFilePath}
              accept="image/*"
              maxSizeMB={5}
              getAuthHeaders={getAuthHeaders}
              onSaved={() => load()}
              className="mt-2"
            />
          )}
          {headerMediaType === "VIDEO" && (
            <div className="mt-1">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Embed video URL (YouTube/Vimeo)</label>
              <input
                type="url"
                value={headerMediaUrl}
                onChange={(e) => setHeaderMediaUrl(e.target.value)}
                placeholder="https://www.youtube.com/embed/… or https://player.vimeo.com/…"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
              />
              <p className="text-xs text-zinc-500 mt-1">This is an embed link, not an uploaded file.</p>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-zinc-700">Public Page</label>
            <button
              type="button"
              role="switch"
              aria-checked={published}
              onClick={async () => {
                if (!me?.id) return;
                const hasAvatar = !!(me.avatar_url && me.avatar_url.trim());
                const hasBio = !!(bio.trim());
                const hasLink = [website, xUrl, linkedinUrl, youtubeUrl, telegramUrl].some((u) => u.trim().length > 0);
                if (!published && (!hasAvatar || !hasBio || !hasLink)) {
                  setError("Add an avatar, bio, and at least one link before publishing.");
                  return;
                }
                setError(null);
                setSaving(true);
                const { error: err } = await updateMyProfile(me.id, { published: !published });
                setSaving(false);
                if (err) setError(err);
                else setPublished(!published);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${published ? "bg-primary" : "bg-zinc-200"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition translate-y-0.5 translate-x-0.5 ${published ? "translate-x-5" : ""}`} />
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            {published
              ? (me?.username || me?.twitter_username
                  ? "Your page is visible at https://linkary.xyz/" + (me.username || me.twitter_username || "").replace(/^@/, "").toLowerCase()
                  : "Set a username or connect X to get your public URL.")
              : "Only you can preview it in the app."}
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (!me?.id) return;
                setError(null);
                setSaving(true);
                const { error: err } = await updateMyProfile(me.id, { published: !published });
                setSaving(false);
                if (err) setError(err);
                else setPublished(!published);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${published ? "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50" : "border-primary bg-primary text-white hover:bg-primary/90"}`}
            >
              {published ? "Unpublish" : "Publish my page"}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200 mt-2">
            <label className="text-sm font-medium text-zinc-700">Show reviews on public profile</label>
            <button
              type="button"
              role="switch"
              aria-checked={showReviews}
              onClick={async () => {
                if (!me?.id) return;
                setError(null);
                setSaving(true);
                const { error: err } = await updateMyProfile(me.id, { show_reviews: !showReviews });
                setSaving(false);
                if (err) setError(err);
                else setShowReviews(!showReviews);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${showReviews ? "bg-primary" : "bg-zinc-200"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition translate-y-0.5 translate-x-0.5 ${showReviews ? "translate-x-5" : ""}`} />
            </button>
          </div>
          <p className="text-xs text-zinc-500">When off, the Reviews section is hidden on your public page.</p>
          {(me?.username || me?.twitter_username) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-zinc-600 font-mono">
                linkary.xyz/{(me.username || me.twitter_username || "").replace(/^@/, "").toLowerCase()}
              </span>
              <button
                type="button"
                onClick={() => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : "https://linkary.xyz"}/${(me?.username || me?.twitter_username || "").replace(/^@/, "").toLowerCase()}`;
                  navigator.clipboard.writeText(url).then(() => {
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  });
                }}
                className="text-xs px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              >
                {copySuccess ? "Copied" : "Copy"}
              </button>
              <a
                href={`${typeof window !== "undefined" ? window.location.origin : "https://linkary.xyz"}/${(me?.username || me?.twitter_username || "").replace(/^@/, "").toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              >
                Open
              </a>
            </div>
          )}
          <p className="text-xs text-zinc-500 mt-1">Public updates can take up to 60 seconds for others. While logged in, you see instant preview.</p>
          {!me?.username && !me?.twitter_username && (
            <p className="text-xs text-amber-700">Set a username or connect X to get a public URL.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Roles</label>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <ProfessionSelect
              selectedProfessions={professions}
              onChange={setProfessions}
              allowCreate={true}
              placeholder="Search or add…"
            />
          )}
        </div>

        <LinksEditor
          links={links}
          linksLoading={linksLoading}
          onReload={loadLinks}
          getAuthHeaders={getAuthHeaders}
          onOpenModal={() => setLinkModal({ open: true })}
          onOpenEditModal={(link) => setLinkModal({ open: true, edit: link })}
        />

        {(profileType === "individual" || profileType === "company") && (
          <SkillsEditor
            title={profileType === "company" ? "Services / Expertise" : "Skills"}
            skills={skills}
            skillsLoading={skillsLoading}
            onReload={loadSkills}
            getAuthHeaders={getAuthHeaders}
            onOpenModal={() => { setSkillForm({ name: "", level: null, is_public: true }); setSkillModal({ open: true }); }}
            onOpenEditModal={(skill) => { setSkillForm({ name: skill.name, level: skill.level, is_public: skill.is_public }); setSkillModal({ open: true, edit: skill }); }}
          />
        )}

        {profileType === "individual" && (
          <AchievementsEditor
            achievements={achievements}
            achievementsLoading={achievementsLoading}
            onReload={loadAchievements}
            getAuthHeaders={getAuthHeaders}
            onOpenModal={() => { setAchievementForm({ title: "", description: "", url: "", is_public: true }); setAchievementModal({ open: true }); }}
            onOpenEditModal={(a) => { setAchievementForm({ title: a.title, description: a.description ?? "", url: (a.url ?? a.proof_url ?? "") as string, is_public: a.is_public }); setAchievementModal({ open: true, edit: a }); }}
          />
        )}

        <RelationsEditor
          relations={relations}
          relationsLoading={relationsLoading}
          profileType={profileType}
          onReload={loadRelations}
          getAuthHeaders={getAuthHeaders}
          onOpenAddModal={(relationType) => {
            setRelationModal({ open: true, relationType });
            setRelationForm({ is_public: true });
            setRelationSearchQuery("");
            setRelationSearchResults([]);
            setSelectedRelationTarget(null);
          }}
          onOpenEditModal={(r) => {
            setRelationModal({ open: true, relationType: r.relation_type, edit: r });
            setRelationForm({ is_public: r.is_public });
            setSelectedRelationTarget(r.target_profile ?? null);
          }}
          setError={setError}
        />

        <PartnerProgramsEditor
          me={me}
          partners={partners}
          partnersLoading={partnersLoading}
          onReload={loadPartners}
          getAuthHeaders={getAuthHeaders}
          onOpenModal={(programType, edit) => setPartnerModal({ open: true, programType, edit })}
        />

        <TeamEditor
          me={me}
          profileType={profileType}
          team={team}
          teamLoading={teamLoading}
          onReload={loadTeam}
          getAuthHeaders={getAuthHeaders}
          onOpenModal={() => setTeamModal({ open: true })}
          onOpenEditModal={(m) => {
            setTeamForm({
              name: m.name,
              role: m.role ?? "",
              avatar_url: m.avatar_url ?? "",
              linkedin_url: m.linkedin_url ?? "",
              x_url: m.x_url ?? "",
              website_url: m.website_url ?? "",
              is_public: m.is_public,
            });
            setTeamModal({ open: true, edit: m });
          }}
        />

        {(profileType === "project" || profileType === "company") && (
          <GigsEditor
            me={me}
            gigs={myGigs}
            gigsLoading={gigsLoading}
            onReload={loadGigs}
            getAuthHeaders={getAuthHeaders}
            onOpenGigModal={(edit) => {
              if (edit) {
                setGigForm({
                  title: edit.title,
                  description: edit.description,
                  gig_type: edit.gig_type,
                  compensation_type: edit.compensation_type,
                  budget_text: edit.budget_text ?? "",
                  location: edit.location ?? "",
                  remote: edit.remote,
                  is_public: edit.is_public,
                });
                setGigModal({ open: true, edit });
              } else {
                setGigForm({
                  title: "",
                  description: "",
                  gig_type: "ambassador",
                  compensation_type: "paid",
                  budget_text: "",
                  location: "",
                  remote: true,
                  is_public: true,
                });
                setGigModal({ open: true });
              }
            }}
            onOpenApplications={(gigId) => {
              setApplicationsGigId(gigId);
              loadApplications(gigId);
            }}
            setError={setError}
          />
        )}

        <CaseStudiesEditor
          me={me}
          caseStudies={caseStudies}
          signedImageUrlsByPath={signedCaseStudyUrlsByPath}
          onReload={loadCaseStudies}
          onOpenAddModal={() => {
            setEditingCaseStudy(null);
            setCaseStudyForm({ title: "", description: "", proofUrl: "", is_public: true });
            setCaseStudyModal(true);
          }}
          onOpenEditModal={(cs) => {
            setEditingCaseStudy(cs);
            setCaseStudyForm({
              title: cs.title ?? "",
              description: cs.description ?? "",
              proofUrl: cs.proof_url ?? "",
              is_public: (cs as { is_public?: boolean }).is_public ?? true,
            });
            setCaseStudyModal(true);
          }}
          setError={setError}
        />

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setRoute({ name: "profile" })}
            className="py-2.5 px-4 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </form>

      {partnerModal.open && (
        <PartnerModal
          programType={partnerModal.programType}
          edit={partnerModal.edit}
          partners={partners}
          form={partnerForm}
          setForm={setPartnerForm}
          saving={partnerSaving}
          onClose={() => setPartnerModal({ open: false })}
          getAuthHeaders={getAuthHeaders}
          onLogoSaved={loadPartners}
          onSubmit={async (body) => {
            if (!me?.id) return;
            setPartnerSaving(true);
            const headers = await getAuthHeaders();
            const base = typeof window !== "undefined" ? window.location.origin : "";
            const editing = partnerModal.open && "edit" in partnerModal ? partnerModal.edit : undefined;
            if (editing) {
              const res = await fetch(`${base}/api/partners/${editing.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...headers },
                body: JSON.stringify({ ...body, targetProfileId: partnerForm.targetProfileId ?? null }),
              });
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                setError(j.message || "Update failed");
              } else {
                loadPartners();
                setPartnerModal({ open: false });
              }
            } else {
              const res = await fetch(`${base}/api/partners`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...headers },
                body: JSON.stringify({ ownerType: "profile", ownerId: me.id, programType: partnerModal.programType, ...body, targetProfileId: partnerForm.targetProfileId ?? null }),
              });
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                setError(j.message || "Create failed");
              } else {
                loadPartners();
                setPartnerModal({ open: false });
              }
            }
            setPartnerSaving(false);
          }}
        />
      )}

      {gigModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setGigModal({ open: false })}>
          <div className="rounded-xl border border-border bg-card shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-foreground">{gigModal.edit ? "Edit gig" : "Create gig"}</h3>
            <input type="text" placeholder="Title *" value={gigForm.title} onChange={(e) => setGigForm((f) => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
            <textarea placeholder="Description *" value={gigForm.description} onChange={(e) => setGigForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Type</label>
              <select value={gigForm.gig_type} onChange={(e) => setGigForm((f) => ({ ...f, gig_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground">
                {GIG_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Compensation</label>
              <select value={gigForm.compensation_type} onChange={(e) => setGigForm((f) => ({ ...f, compensation_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground">
                {COMP_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <input type="text" placeholder="Budget (free text)" value={gigForm.budget_text} onChange={(e) => setGigForm((f) => ({ ...f, budget_text: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
            <input type="text" placeholder="Location (optional)" value={gigForm.location} onChange={(e) => setGigForm((f) => ({ ...f, location: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={gigForm.remote} onChange={(e) => setGigForm((f) => ({ ...f, remote: e.target.checked }))} />
              <span className="text-sm text-foreground">Remote</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={gigForm.is_public} onChange={(e) => setGigForm((f) => ({ ...f, is_public: e.target.checked }))} />
              <span className="text-sm text-foreground">Public (show on profile)</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setGigModal({ open: false })} className="px-3 py-1.5 rounded-lg border border-border text-foreground bg-background">Cancel</button>
              <button
                type="button"
                disabled={!gigForm.title.trim() || !gigForm.description.trim() || gigSaving}
                onClick={async () => {
                  if (!me?.id) return;
                  setGigSaving(true);
                  const headers = await getAuthHeaders();
                  const base = typeof window !== "undefined" ? window.location.origin : "";
                  const body = {
                    title: gigForm.title.trim(),
                    description: gigForm.description.trim(),
                    gig_type: gigForm.gig_type,
                    compensation_type: gigForm.compensation_type,
                    budget_text: gigForm.budget_text.trim() || null,
                    location: gigForm.location.trim() || null,
                    remote: gigForm.remote,
                    is_public: gigForm.is_public,
                  };
                  if (gigModal.edit) {
                    const res = await fetch(`${base}/api/gigs/${gigModal.edit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
                    const j = await res.json().catch(() => ({}));
                    setGigSaving(false);
                    if (res.ok) { loadGigs(); setGigModal({ open: false }); }
                    else setError(j.message ?? "Update failed");
                  } else {
                    const res = await fetch(`${base}/api/gigs`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
                    const j = await res.json().catch(() => ({}));
                    setGigSaving(false);
                    if (res.ok) { loadGigs(); setGigModal({ open: false }); }
                    else setError(j.message ?? "Create failed");
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                {gigSaving ? "Saving…" : gigModal.edit ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {applicationsGigId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setApplicationsGigId(null); setDealCreatedNote(false); }}>
          <div className="rounded-xl border border-border bg-card shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-foreground">Applications</h3>
            {dealCreatedNote && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-foreground">
                Deal created.{" "}
                <a href="/profile/deals" className="font-medium text-primary hover:underline">View in Deals</a>
              </div>
            )}
            {applicationsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : applicationsList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <ul className="space-y-3">
                {applicationsList.map((app) => (
                  <li key={app.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {app.applicant?.avatar_url ? (
                          <img src={app.applicant.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover border border-border shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted border border-border shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{app.applicant?.display_name ?? app.applicant?.username ?? "Applicant"}</p>
                          {app.applicant?.username && <p className="text-xs text-muted-foreground">@{app.applicant.username}</p>}
                        </div>
                      </div>
                      <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground capitalize shrink-0">{app.status}</span>
                    </div>
                    {app.message && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{app.message}</p>}
                    {app.case_studies && app.case_studies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {app.case_studies.map((cs) => (
                          <a key={cs.id} href={cs.proof_url ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded border border-border bg-muted/50 px-2 py-0.5 text-xs text-foreground hover:bg-accent/50">
                            {cs.title || "Proof"}
                          </a>
                        ))}
                      </div>
                    )}
                    {app.status === "submitted" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={applicationStatusSaving === app.id}
                          onClick={async () => {
                            setApplicationStatusSaving(app.id);
                            setDealCreatedNote(false);
                            const headers = await getAuthHeaders();
                            const base = typeof window !== "undefined" ? window.location.origin : "";
                            const res = await fetch(`${base}/api/gig-applications/${app.id}/status`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", ...headers },
                              body: JSON.stringify({ status: "accepted" }),
                            });
                            const json = await res.json().catch(() => ({}));
                            setApplicationStatusSaving(null);
                            loadApplications(applicationsGigId!);
                            if (json.ok && json.dealCreated) setDealCreatedNote(true);
                          }}
                          className="px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={applicationStatusSaving === app.id}
                          onClick={async () => {
                            setApplicationStatusSaving(app.id);
                            const headers = await getAuthHeaders();
                            const base = typeof window !== "undefined" ? window.location.origin : "";
                            await fetch(`${base}/api/gig-applications/${app.id}/status`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", ...headers },
                              body: JSON.stringify({ status: "rejected" }),
                            });
                            setApplicationStatusSaving(null);
                            loadApplications(applicationsGigId!);
                          }}
                          className="px-2 py-1 rounded text-xs font-medium border border-border text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={() => { setApplicationsGigId(null); setDealCreatedNote(false); }} className="px-3 py-1.5 rounded-lg border border-border text-foreground bg-background">Close</button>
            </div>
          </div>
        </div>
      )}

      {caseStudyModal && (
        <CaseStudyModal
          edit={editingCaseStudy}
          form={caseStudyForm}
          setForm={setCaseStudyForm}
          saving={caseStudySaving}
          onClose={() => {
            setCaseStudyModal(false);
            setEditingCaseStudy(null);
          }}
          getAuthHeaders={getAuthHeaders}
          onImageSaved={loadCaseStudies}
          onSubmit={async () => {
            if (!me?.id) return;
            setCaseStudySaving(true);
            const base = typeof window !== "undefined" ? window.location.origin : "";
            const headers = await getAuthHeaders();
            if (editingCaseStudy) {
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
              const json = await res.json().catch(() => ({}));
              setCaseStudySaving(false);
              if (!res.ok) {
                setError(json.message ?? "Update failed");
              } else {
                setCaseStudyForm({ title: "", description: "", proofUrl: "", is_public: true });
                loadCaseStudies();
                setCaseStudyModal(false);
                setEditingCaseStudy(null);
              }
            } else {
              const { data, error: err } = await createCaseStudyForProfile(me.id, {
                title: caseStudyForm.title.trim() || undefined,
                description: caseStudyForm.description.trim() || undefined,
                proof_url: caseStudyForm.proofUrl.trim() || undefined,
                is_public: caseStudyForm.is_public,
              });
              setCaseStudySaving(false);
              if (err) setError(err);
              else {
                setCaseStudyForm({ title: "", description: "", proofUrl: "", is_public: true });
                loadCaseStudies();
                setCaseStudyModal(false);
              }
            }
          }}
        />
      )}

      {linkModal.open && (
        <LinkModal
          edit={linkModal.open && "edit" in linkModal ? linkModal.edit : undefined}
          form={linkForm}
          setForm={setLinkForm}
          saving={linkSaving}
          onClose={() => setLinkModal({ open: false })}
          onSubmit={async () => {
            if (!me?.id) return;
            setLinkSaving(true);
            const base = typeof window !== "undefined" ? window.location.origin : "";
            const headers = await getAuthHeaders();
            const edit = linkModal.open && "edit" in linkModal ? linkModal.edit : undefined;
            try {
              if (edit) {
                const res = await fetch(`${base}/api/profile/links/${edit.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify({
                    title: linkForm.title.trim(),
                    url: linkForm.url.trim(),
                    icon: linkForm.icon.trim() || null,
                    is_public: linkForm.is_public,
                  }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setError(json.message ?? "Update failed");
                } else {
                  loadLinks();
                  setLinkModal({ open: false });
                }
              } else {
                const res = await fetch(`${base}/api/profile/links`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify({
                    title: linkForm.title.trim(),
                    url: linkForm.url.trim(),
                    icon: linkForm.icon.trim() || null,
                    is_public: linkForm.is_public,
                  }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setError(json.message ?? json.code ?? "Create failed");
                } else {
                  loadLinks();
                  setLinkModal({ open: false });
                }
              }
            } finally {
              setLinkSaving(false);
            }
          }}
        />
      )}

      {skillModal.open && (
        <SkillModal
          edit={skillModal.open && "edit" in skillModal ? skillModal.edit : undefined}
          form={skillForm}
          setForm={setSkillForm}
          saving={skillSaving}
          onClose={() => setSkillModal({ open: false })}
          onSubmit={async () => {
            setSkillSaving(true);
            const base = typeof window !== "undefined" ? window.location.origin : "";
            const headers = await getAuthHeaders();
            const edit = skillModal.open && "edit" in skillModal ? skillModal.edit : undefined;
            try {
              if (edit) {
                const res = await fetch(`${base}/api/profile/skills/${edit.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify({ name: skillForm.name.trim(), level: skillForm.level, is_public: skillForm.is_public }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) setError(json.message ?? "Update failed");
                else { loadSkills(); setSkillModal({ open: false }); }
              } else {
                const res = await fetch(`${base}/api/profile/skills`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify({ name: skillForm.name.trim(), level: skillForm.level, is_public: skillForm.is_public }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) setError(json.message ?? json.code ?? "Create failed");
                else { loadSkills(); setSkillModal({ open: false }); }
              }
            } finally {
              setSkillSaving(false);
            }
          }}
        />
      )}

      {achievementModal.open && (
        <AchievementModal
          edit={achievementModal.open && "edit" in achievementModal ? achievementModal.edit : undefined}
          form={achievementForm}
          setForm={setAchievementForm}
          saving={achievementSaving}
          onClose={() => setAchievementModal({ open: false })}
          onSubmit={async () => {
            setAchievementSaving(true);
            const base = typeof window !== "undefined" ? window.location.origin : "";
            const headers = await getAuthHeaders();
            const edit = achievementModal.open && "edit" in achievementModal ? achievementModal.edit : undefined;
            const url = achievementForm.url.trim();
            const payload = {
              title: achievementForm.title.trim(),
              description: achievementForm.description.trim() || null,
              url: url && (url.startsWith("http://") || url.startsWith("https://")) ? url : null,
              is_public: achievementForm.is_public,
            };
            try {
              if (edit) {
                const res = await fetch(`${base}/api/profile/achievements/${edit.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify(payload),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) setError(json.message ?? "Update failed");
                else { loadAchievements(); setAchievementModal({ open: false }); }
              } else {
                const res = await fetch(`${base}/api/profile/achievements`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify(payload),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) setError(json.message ?? json.code ?? "Create failed");
                else { loadAchievements(); setAchievementModal({ open: false }); }
              }
            } finally {
              setAchievementSaving(false);
            }
          }}
        />
      )}

      {relationModal.open && (
        <RelationModal
          relationType={relationModal.relationType}
          edit={relationModal.open && "edit" in relationModal ? relationModal.edit : undefined}
          selectedTarget={selectedRelationTarget}
          form={relationForm}
          setForm={setRelationForm}
          searchQuery={relationSearchQuery}
          searchResults={relationSearchResults}
          searchLoading={relationSearchLoading}
          onSearch={setRelationSearchQuery}
          onSelectTarget={(p) => setSelectedRelationTarget(p)}
          onClose={() => setRelationModal({ open: false })}
          onSubmit={async () => {
            const base = typeof window !== "undefined" ? window.location.origin : "";
            const headers = await getAuthHeaders();
            setRelationSaving(true);
            try {
              const edit = relationModal.open && "edit" in relationModal ? relationModal.edit : undefined;
              if (edit) {
                const res = await fetch(`${base}/api/profile/relations/${edit.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify({ is_public: relationForm.is_public }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) setError(json.message ?? "Update failed");
                else { loadRelations(); setRelationModal({ open: false }); }
              } else {
                if (!selectedRelationTarget) return;
                const res = await fetch(`${base}/api/profile/relations`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify({
                    target_profile_id: selectedRelationTarget.id,
                    relation_type: relationModal.relationType,
                    is_public: relationForm.is_public,
                  }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) setError(json.message ?? json.code ?? "Create failed");
                else { loadRelations(); setRelationModal({ open: false }); setSelectedRelationTarget(null); }
              }
            } finally {
              setRelationSaving(false);
            }
          }}
          saving={relationSaving}
        />
      )}

      {teamModal.open && (
        <TeamMemberModal
          edit={teamModal.open && "edit" in teamModal ? teamModal.edit : undefined}
          form={teamForm}
          setForm={setTeamForm}
          saving={teamSaving}
          onClose={() => setTeamModal({ open: false })}
          onSubmit={async () => {
            if (!me?.id) return;
            setTeamSaving(true);
            const base = typeof window !== "undefined" ? window.location.origin : "";
            const headers = await getAuthHeaders();
            const edit = teamModal.open && "edit" in teamModal ? teamModal.edit : undefined;
            try {
              if (edit) {
                const res = await fetch(`${base}/api/org-team/${edit.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify({
                    name: teamForm.name.trim(),
                    role: teamForm.role.trim() || null,
                    avatar_url: teamForm.avatar_url.trim() || null,
                    linkedin_url: teamForm.linkedin_url.trim() || null,
                    x_url: teamForm.x_url.trim() || null,
                    website_url: teamForm.website_url.trim() || null,
                    is_public: teamForm.is_public,
                  }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setError(json.message ?? "Update failed");
                } else {
                  loadTeam();
                  setTeamModal({ open: false });
                }
              } else {
                const res = await fetch(`${base}/api/org-team`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify({
                    name: teamForm.name.trim(),
                    role: teamForm.role.trim() || null,
                    avatar_url: teamForm.avatar_url.trim() || null,
                    linkedin_url: teamForm.linkedin_url.trim() || null,
                    x_url: teamForm.x_url.trim() || null,
                    website_url: teamForm.website_url.trim() || null,
                    is_public: teamForm.is_public,
                  }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setError(json.message ?? json.code ?? "Create failed");
                } else {
                  loadTeam();
                  setTeamModal({ open: false });
                }
              }
            } finally {
              setTeamSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}
