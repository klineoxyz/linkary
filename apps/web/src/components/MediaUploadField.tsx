"use client";

import React, { useState, useEffect } from "react";

const MEDIA_TYPES = ["profile_header", "org_logo", "partner_logo", "case_study_proof"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

export type MediaUploadFieldProps = {
  label: string;
  type: MediaType;
  ownerId: string;
  value: string | null;
  onChange: (filePath: string | null) => void;
  accept?: string;
  maxSizeMB?: number;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onSaved?: () => void;
  className?: string;
};

export function MediaUploadField({
  label,
  type,
  ownerId,
  value,
  onChange,
  accept = "image/*",
  maxSizeMB = 5,
  getAuthHeaders,
  onSaved,
  className = "",
}: MediaUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${base}/api/media/signed-url?path=${encodeURIComponent(value)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!cancelled && data?.url) setPreviewUrl(data.url);
    })();
    return () => {
      cancelled = true;
    };
  }, [value, base, getAuthHeaders]);

  const handleFile = async (file: File) => {
    if (!ownerId) return;
    const sizeMB = file.size / (1024 * 1024);
    if (maxSizeMB > 0 && sizeMB > maxSizeMB) {
      setError(`File must be under ${maxSizeMB}MB`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const urlRes = await fetch(`${base}/api/media/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ type, owner_id: ownerId, file_name: file.name, content_type: file.type }),
      });
      const urlJson = await urlRes.json();
      if (!urlRes.ok || !urlJson.uploadUrl || !urlJson.file_path) {
        setError(urlJson.error || "Failed to get upload URL");
        return;
      }
      const putRes = await fetch(urlJson.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!putRes.ok) {
        setError("Upload failed");
        return;
      }
      const commitRes = await fetch(`${base}/api/media/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ type, owner_id: ownerId, file_path: urlJson.file_path }),
      });
      const commitJson = await commitRes.json();
      if (!commitRes.ok || !commitJson.ok) {
        setError(commitJson.error || "Failed to save");
        return;
      }
      onChange(urlJson.file_path);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!ownerId || !value) return;
    if (!confirm("Remove this file?")) return;
    setRemoving(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${base}/api/media/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ type, owner_id: ownerId }),
      });
      const json = await res.json();
      if (!res.ok && !json.ok) setError(json.error || "Delete failed");
      else {
        onChange(null);
        onSaved?.();
      }
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <>
            {previewUrl && (
              <div className="w-20 h-20 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0">
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 truncate max-w-[200px]">{value.split("/").pop() ?? "File"}</span>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept={accept}
                  className="hidden"
                  id={`media-upload-${type}-${ownerId}`}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
                <label htmlFor={`media-upload-${type}-${ownerId}`} className={`text-sm text-primary cursor-pointer hover:underline ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploading ? "Uploading…" : "Replace"}
                </label>
                <button type="button" onClick={handleRemove} disabled={removing} className="text-sm text-red-600 hover:underline disabled:opacity-50">
                  {removing ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <input
              type="file"
              accept={accept}
              className="hidden"
              id={`media-upload-${type}-${ownerId}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <label
              htmlFor={`media-upload-${type}-${ownerId}`}
              className={`inline-block px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              {uploading ? "Uploading…" : "Choose file"}
            </label>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}
