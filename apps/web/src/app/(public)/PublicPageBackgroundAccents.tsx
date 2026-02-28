"use client";

/**
 * Subtle gradient blobs for public profile pages only.
 * Renders behind content; no white overlay. Does not affect /profile or dashboard.
 */
export function PublicPageBackgroundAccents() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute -left-[20%] top-[10%] h-[40vmin] w-[40vmin] rounded-full opacity-[0.06]"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
      <div
        className="absolute -right-[15%] top-[50%] h-[50vmin] w-[50vmin] rounded-full opacity-[0.05]"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[5%] left-[30%] h-[30vmin] w-[30vmin] rounded-full opacity-[0.04]"
        style={{ background: "radial-gradient(circle, hsl(var(--chart-1)) 0%, transparent 70%)" }}
      />
    </div>
  );
}
