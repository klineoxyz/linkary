export default function AppShellLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
      <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
    </div>
  );
}
