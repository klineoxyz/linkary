"use client";

type HeroMediaProps = {
  type: "NONE" | "IMAGE" | "VIDEO";
  url: string | null;
  alt?: string;
};

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") {
      const v = u.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (u.hostname === "youtu.be") {
      const v = u.pathname.slice(1).split("/")[0];
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function getVimeoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "www.vimeo.com" || u.hostname === "vimeo.com") {
      const id = u.pathname.replace(/^\/+/, "").split("/")[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isDirectVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.includes(".mp4?") || lower.includes(".webm?");
}

export function HeroMedia({ type, url, alt = "" }: HeroMediaProps) {
  const safeUrl = url?.trim();
  const isHttps = safeUrl && (safeUrl.startsWith("https://") || safeUrl.startsWith("http://"));

  if (type === "NONE" || !safeUrl || !isHttps) {
    return (
      <div className="w-full overflow-hidden rounded-lg border border-border bg-muted/30 aspect-video flex items-center justify-center">
        <p className="text-sm text-muted-foreground px-4 text-center">Add a hero media in profile settings</p>
      </div>
    );
  }

  if (type === "IMAGE") {
    return (
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-muted aspect-video">
        <img
          src={safeUrl}
          alt={alt || "Header"}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (type === "VIDEO") {
    const yt = getYouTubeEmbedUrl(safeUrl);
    if (yt) {
      return (
        <div className="relative w-full overflow-hidden rounded-lg border border-border bg-muted aspect-video">
          <iframe
            src={yt}
            title="Video"
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    const vimeo = getVimeoEmbedUrl(safeUrl);
    if (vimeo) {
      return (
        <div className="relative w-full overflow-hidden rounded-lg border border-border bg-muted aspect-video">
          <iframe
            src={vimeo}
            title="Video"
            className="absolute inset-0 h-full w-full"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    if (isDirectVideoUrl(safeUrl)) {
      return (
        <div className="relative w-full overflow-hidden rounded-lg border border-border bg-muted aspect-video">
          <video
            src={safeUrl}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
          />
        </div>
      );
    }
    return (
      <div className="w-full overflow-hidden rounded-lg border border-border bg-muted/30 aspect-video flex items-center justify-center">
        <p className="text-sm text-muted-foreground px-4 text-center">Add a hero media in profile settings</p>
      </div>
    );
  }

  return null;
}
