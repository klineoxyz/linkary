export default function PublicPageSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground animate-pulse">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
            <div className="h-5 w-32 rounded bg-muted" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 pb-24">
        <section className="mb-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                <div className="h-20 w-20 shrink-0 rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-7 w-48 rounded bg-muted" />
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-full max-w-sm rounded bg-muted" />
                </div>
              </div>
            </div>
            <div className="grid w-full grid-cols-3 gap-3 md:w-auto md:min-w-[200px]">
              <div className="h-16 rounded-lg bg-muted" />
              <div className="h-16 rounded-lg bg-muted" />
              <div className="h-16 rounded-lg bg-muted" />
            </div>
          </div>
        </section>
        <div className="space-y-10">
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-32 rounded-xl bg-muted" />
          <div className="h-40 rounded-xl bg-muted" />
        </div>
      </main>
    </div>
  );
}
