import Link from "next/link";

export function NotFoundClaimView({ requestedUsername }: { requestedUsername: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">This link isn’t set up yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          linkary.xyz/@{requestedUsername} is available. Claim it and build your verified link-in-bio.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="w-full sm:w-auto inline-flex justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Claim this username
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Log in with X
          </Link>
        </div>
      </div>
    </div>
  );
}
