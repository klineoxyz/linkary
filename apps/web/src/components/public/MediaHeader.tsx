"use client";

type MediaHeaderProps = {
  type: "NONE" | "IMAGE" | "VIDEO";
  url: string | null;
  alt?: string;
};

export function MediaHeader({ type, url, alt = "" }: MediaHeaderProps) {
  if (type === "NONE" || !url?.trim()) return null;
  if (type === "VIDEO") return null; // Video URLs (e.g. X.com) are not direct assets; only image headers are shown.

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
      <img
        src={url}
        alt={alt || "Header"}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
