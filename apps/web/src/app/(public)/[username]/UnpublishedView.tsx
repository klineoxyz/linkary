import Link from "next/link";

export function UnpublishedView({ username }: { username: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">This profile is not published</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          @{username} exists but is not visible to the public yet.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
