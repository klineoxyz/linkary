export default function OrgDetailLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center bg-background" aria-busy="true">
      <div className="animate-pulse text-muted-foreground text-sm">Loading org…</div>
    </div>
  );
}
