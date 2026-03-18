import Link from "next/link";

type Props = { username: string };

/**
 * Shown when the visitor is the owner of the slug but the profile is not published.
 * CTAs: Edit profile, Go to dashboard, optional Publish.
 */
export function OwnerUnpublishedProfile({ username }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">The public profile is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is not published yet. Only you can see this message. Publish from the editor to make it public.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          linkary.xyz/@{username}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/app/profile/edit"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Edit profile
          </Link>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Go to dashboard
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Publish
          </Link>
        </div>
      </div>
    </div>
  );
}
