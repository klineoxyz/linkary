"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listProfessions, upsertProfession } from "@/lib/professions";
import type { Profession } from "@/lib/professions";

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function ProfessionSelect({
  selectedProfessions,
  onChange,
  allowCreate = true,
  placeholder = "Search or add…",
  className = "",
}: {
  selectedProfessions: Profession[];
  onChange: (selected: Profession[]) => void;
  allowCreate?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [allProfessions, setAllProfessions] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadProfessions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listProfessions();
    setLoading(false);
    if (!error && data) setAllProfessions(data);
  }, []);

  useEffect(() => {
    loadProfessions();
  }, [loadProfessions]);

  const selectedIds = useMemo(() => new Set(selectedProfessions.map((p) => p.id)), [selectedProfessions]);

  const querySlug = useMemo(() => slugFromName(query), [query]);
  const matches = useMemo(() => {
    if (!query.trim()) return allProfessions;
    return allProfessions.filter((p) => p.slug.includes(querySlug) || p.name.toLowerCase().includes(query.trim().toLowerCase()));
  }, [allProfessions, query, querySlug]);

  const exactMatch = useMemo(
    () => allProfessions.find((p) => p.slug === querySlug || p.name.toLowerCase() === query.trim().toLowerCase()),
    [allProfessions, query, querySlug]
  );
  const showAddOption = allowCreate && query.trim() && !exactMatch;

  const addSelected = useCallback(
    (p: Profession) => {
      if (selectedIds.has(p.id)) return;
      onChange([...selectedProfessions, p]);
    },
    [onChange, selectedIds, selectedProfessions]
  );

  const removeSelected = useCallback(
    (id: string) => {
      onChange(selectedProfessions.filter((p) => p.id !== id));
    },
    [onChange, selectedProfessions]
  );

  const handleCreateAndAdd = useCallback(async () => {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    const { id, error } = await upsertProfession(name);
    setCreating(false);
    if (error) return;
    if (id) {
      const newProfession: Profession = { id, name, slug: slugFromName(name), created_at: new Date().toISOString(), created_by: null };
      addSelected(newProfession);
      setAllProfessions((prev) => (prev.some((p) => p.id === id) ? prev : [...prev, newProfession]));
      setQuery("");
    }
  }, [query, addSelected]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-300 bg-white p-2 min-h-[42px]">
        {selectedProfessions.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-sm text-foreground"
          >
            {p.name}
            <button
              type="button"
              onClick={() => removeSelected(p.id)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-accent/80 text-primary"
              aria-label={`Remove ${p.name}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={selectedProfessions.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] border-0 bg-transparent px-1 py-1 text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-0"
        />
      </div>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg max-h-56 overflow-auto">
          {loading ? (
            <div className="px-3 py-2 text-sm text-zinc-500">Loading…</div>
          ) : (
            <>
              {matches
                .filter((p) => !selectedIds.has(p.id))
                .slice(0, 15)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      addSelected(p);
                      setQuery("");
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                  >
                    {p.name}
                  </button>
                ))}
              {showAddOption && (
                <button
                  type="button"
                  onClick={handleCreateAndAdd}
                  disabled={creating}
                  className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-accent disabled:opacity-50"
                >
                  {creating ? "Adding…" : `Add "${query.trim()}"`}
                </button>
              )}
              {!query.trim() && matches.length === 0 && !showAddOption && (
                <div className="px-3 py-2 text-sm text-zinc-500">No professions yet. Type to add one.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
