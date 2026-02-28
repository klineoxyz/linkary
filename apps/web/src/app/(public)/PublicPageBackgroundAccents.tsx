"use client";

/**
 * Linkary background accents for public profile pages only.
 * Soft island blobs using primary/accent/chart-1; behind content, no white wash.
 */
export function PublicPageBackgroundAccents() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute -left-[15%] top-[5%] h-[45vmin] w-[45vmin] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
      <div
        className="absolute -right-[10%] top-[8%] h-[40vmin] w-[40vmin] rounded-full opacity-[0.10] blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)" }}
      />
      <div
        className="absolute right-[0%] top-[45%] h-[50vmin] w-[50vmin] rounded-full opacity-[0.08] blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[10%] left-[10%] h-[35vmin] w-[35vmin] rounded-full opacity-[0.10] blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--chart-1)) 0%, transparent 70%)" }}
      />
      <div
        className="absolute left-[40%] bottom-[25%] h-[30vmin] w-[30vmin] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)" }}
      />
    </div>
  );
}
