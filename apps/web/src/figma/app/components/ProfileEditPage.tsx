"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { updateMyProfile } from "@/lib/profiles";
import { getProfileProfessions, setProfileProfessions } from "@/lib/profileProfessions";
import { sanitizeUrl } from "@/lib/sanitizeUrl";
import { listCaseStudiesForProfile, createCaseStudyForProfile, type CaseStudy } from "@/lib/caseStudies";
import ProfessionSelect from "./ProfessionSelect";
import type { Profession } from "@/lib/professions";
import type { Profile } from "@/lib/profiles";

type HeaderMediaType = "NONE" | "IMAGE" | "VIDEO";

type PartnerRow = {
  id: string;
  owner_type: string;
  owner_id: string;
  program_type: "affiliate" | "ambassador";
  name: string;
  website_url: string | null;
  logo_url: string | null;
  description: string | null;
  since_date: string | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
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
                {p.logo_url && <img src={p.logo_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />}
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

function CaseStudiesEditor({
  me,
  caseStudies,
  onReload,
  onOpenAddModal,
  setError,
}: {
  me: Profile;
  caseStudies: CaseStudy[];
  onReload: () => void;
  onOpenAddModal: () => void;
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
      <ul className="space-y-2">
        {caseStudies.map((cs) => (
          <li key={cs.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-zinc-900 truncate">{cs.title || "Untitled"}</div>
              {cs.description && <div className="text-xs text-zinc-500 line-clamp-2">{cs.description}</div>}
            </div>
            <button type="button" onClick={() => remove(cs.id)} className="text-xs text-red-600 hover:underline shrink-0">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PartnerModal({
  programType,
  edit,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  programType: "affiliate" | "ambassador";
  edit?: PartnerRow;
  form: { name: string; websiteUrl: string; logoUrl: string; description: string; sinceDate: string; isFeatured: boolean };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; websiteUrl: string; logoUrl: string; description: string; sinceDate: string; isFeatured: boolean }>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: { name: string; websiteUrl?: string | null; logoUrl?: string | null; description?: string | null; sinceDate?: string | null; isFeatured?: boolean }) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-zinc-900">{edit ? "Edit" : "Add"} {programType}</h3>
        <input type="text" placeholder="Name (required)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="url" placeholder="Website URL" value={form.websiteUrl} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="url" placeholder="Logo URL" value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <textarea placeholder="Description (max 280 chars)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value.slice(0, 280) }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="date" placeholder="Since date" value={form.sinceDate} onChange={(e) => setForm((f) => ({ ...f, sinceDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} />
          <span className="text-sm text-zinc-700">Featured</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700">Cancel</button>
          <button type="button" disabled={!form.name.trim() || saving} onClick={() => onSubmit({ name: form.name.trim(), websiteUrl: form.websiteUrl.trim() || null, logoUrl: form.logoUrl.trim() || null, description: form.description.trim() || null, sinceDate: form.sinceDate.trim() || null, isFeatured: form.isFeatured })} className="px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-50">
            {saving ? "Saving…" : edit ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CaseStudyModal({
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  form: { title: string; description: string; proofUrl: string };
  setForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; proofUrl: string }>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-zinc-900">Add case study</h3>
        <input type="text" placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <input type="url" placeholder="Proof URL" value={form.proofUrl} onChange={(e) => setForm((f) => ({ ...f, proofUrl: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900" />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700">Cancel</button>
          <button type="button" disabled={saving} onClick={onSubmit} className="px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-50">{saving ? "Saving…" : "Add"}</button>
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
  const [xUrl, setXUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnerModal, setPartnerModal] = useState<{ open: true; programType: "affiliate" | "ambassador"; edit?: PartnerRow } | { open: false }>({ open: false });
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [caseStudyModal, setCaseStudyModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [partnerForm, setPartnerForm] = useState({ name: "", websiteUrl: "", logoUrl: "", description: "", sinceDate: "", isFeatured: false });
  const [caseStudyForm, setCaseStudyForm] = useState({ title: "", description: "", proofUrl: "" });
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [caseStudySaving, setCaseStudySaving] = useState(false);

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
  }, [me?.id]);

  const load = useCallback(async () => {
    if (!me?.id) return;
    setLoading(true);
    const [profResult, mediaData, socialsData] = await Promise.all([
      getProfileProfessions(me.id),
      supabase.from("profile_media").select("header_media_type, header_media_url").eq("profile_id", me.id).maybeSingle(),
      supabase.from("profile_socials").select("x_url, linkedin_url, youtube_url, website_url, telegram_url").eq("profile_id", me.id).maybeSingle(),
    ]);
    loadPartners();
    loadCaseStudies();
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
    }
    if (socialsData?.data) {
      const s = socialsData.data as { x_url?: string | null; linkedin_url?: string | null; youtube_url?: string | null; website_url?: string | null; telegram_url?: string | null };
      setXUrl(s.x_url ?? "");
      setLinkedinUrl(s.linkedin_url ?? "");
      setYoutubeUrl(s.youtube_url ?? "");
      setTelegramUrl(s.telegram_url ?? "");
    }
    if (me?.published != null) setPublished(!!me.published);
  }, [me?.id, me?.display_name, me?.email, me?.bio, me?.website, me?.location, me?.published, loadPartners, loadCaseStudies]);

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
      });
    } else {
      setPartnerForm({ name: "", websiteUrl: "", logoUrl: "", description: "", sinceDate: "", isFeatured: false });
    }
  }, [partnerModal]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.id) return;
    setError(null);
    setSaving(true);
    const { error: profileErr } = await updateMyProfile(me.id, {
      display_name: displayName.trim() || null,
      email: email.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
      location: location.trim() || null,
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
    let effectiveMediaUrl: string | null = headerMediaType !== "NONE" ? headerMediaUrl.trim() || null : null;
    if (effectiveMediaUrl) {
      const sanitized = sanitizeUrl(effectiveMediaUrl);
      if (!sanitized) {
        effectiveMediaUrl = null;
        effectiveMediaType = "NONE";
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
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
          <p className="text-xs text-zinc-500 mb-2">Contact email (stored in your profile).</p>
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
          <label className="block text-sm font-medium text-zinc-700 mb-1">Header media (home &amp; public page)</label>
          <p className="text-xs text-zinc-500 mb-2">Optional video or image shown on your overview and public profile.</p>
          <select
            value={headerMediaType}
            onChange={(e) => setHeaderMediaType(e.target.value as HeaderMediaType)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 mb-2"
          >
            <option value="NONE">None</option>
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
          </select>
          {(headerMediaType === "IMAGE" || headerMediaType === "VIDEO") && (
            <input
              type="url"
              value={headerMediaUrl}
              onChange={(e) => setHeaderMediaUrl(e.target.value)}
              placeholder={headerMediaType === "VIDEO" ? "https://… video URL" : "https://… image URL"}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 mt-1"
            />
          )}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-zinc-700">Publish public page</label>
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
            {published ? "Your public page is live." : "When on, your page is visible at the URL below."}
          </p>
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
          <p className="text-xs text-zinc-500 mt-1">Public updates can take up to 1 minute to appear.</p>
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

        <PartnerProgramsEditor
          me={me}
          partners={partners}
          partnersLoading={partnersLoading}
          onReload={loadPartners}
          getAuthHeaders={getAuthHeaders}
          onOpenModal={(programType, edit) => setPartnerModal({ open: true, programType, edit })}
        />

        <CaseStudiesEditor
          me={me}
          caseStudies={caseStudies}
          onReload={loadCaseStudies}
          onOpenAddModal={() => setCaseStudyModal(true)}
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
          form={partnerForm}
          setForm={setPartnerForm}
          saving={partnerSaving}
          onClose={() => setPartnerModal({ open: false })}
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
                body: JSON.stringify(body),
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
                body: JSON.stringify({ ownerType: "profile", ownerId: me.id, programType: partnerModal.programType, ...body }),
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

      {caseStudyModal && (
        <CaseStudyModal
          form={caseStudyForm}
          setForm={setCaseStudyForm}
          saving={caseStudySaving}
          onClose={() => setCaseStudyModal(false)}
          onSubmit={async () => {
            if (!me?.id) return;
            setCaseStudySaving(true);
            const { data, error: err } = await createCaseStudyForProfile(me.id, {
              title: caseStudyForm.title.trim() || undefined,
              description: caseStudyForm.description.trim() || undefined,
              proof_url: caseStudyForm.proofUrl.trim() || undefined,
            });
            setCaseStudySaving(false);
            if (err) setError(err);
            else {
              setCaseStudyForm({ title: "", description: "", proofUrl: "" });
              loadCaseStudies();
              setCaseStudyModal(false);
            }
          }}
        />
      )}
    </div>
  );
}
