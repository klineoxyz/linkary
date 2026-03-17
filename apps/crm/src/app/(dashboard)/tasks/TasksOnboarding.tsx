/**
 * CRM: Individual task-board onboarding states.
 * Clear messaging hierarchy and CTAs for: no profile, wrong profile type, workspace creation failure.
 */
import Link from "next/link";
import { ListTodo, AlertCircle, Users, Wrench } from "lucide-react";

const cardClass =
  "rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-8 text-center";
const headlineClass = "text-xl font-semibold text-[var(--crm-foreground)] mb-2";
const bodyClass = "text-sm text-[var(--crm-muted)] max-w-md mx-auto mb-6";
const ctaPrimaryClass =
  "inline-flex items-center gap-2 rounded-lg bg-[var(--crm-primary)] px-4 py-2.5 text-sm font-medium text-[var(--crm-primary-foreground)] hover:opacity-90";
const ctaSecondaryClass = "text-sm text-[var(--crm-muted)] hover:text-[var(--crm-primary)] underline mt-4 inline-block";

/** No profile: account not linked to a task board (e.g. CRM-only user, profile insert failed). */
export function TasksNoProfile({
  message,
  hint,
}: {
  message: string;
  hint: string | null;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">Tasks</h1>
      <div className={cardClass}>
        <div className="flex justify-center mb-4">
          <AlertCircle className="h-12 w-12 text-[var(--crm-muted)]" aria-hidden />
        </div>
        <h2 className={headlineClass}>Set up your account for Tasks</h2>
        <p className="text-[var(--crm-foreground)] font-medium mb-2">{message}</p>
        {hint && <p className={bodyClass}>{hint}</p>}
        <p className="text-xs text-[var(--crm-muted)] mt-4">
          If you use Linkary, sign in there first so your profile is created, then return here and open Tasks again.
        </p>
        <Link href="/" className={ctaSecondaryClass}>
          Back to home
        </Link>
      </div>
    </div>
  );
}

/** Wrong profile type: org/project/company — not eligible for personal task board. */
export function TasksWrongProfileType() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">Tasks</h1>
      <div className={cardClass}>
        <div className="flex justify-center mb-4">
          <Users className="h-12 w-12 text-[var(--crm-muted)]" aria-hidden />
        </div>
        <h2 className={headlineClass}>Personal task board isn’t available</h2>
        <p className={bodyClass}>
          Your account is set up as an org or project, not an individual creator. Only individual creator accounts get a personal task board.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/campaigns" className={ctaPrimaryClass}>
            Go to Campaigns
          </Link>
          <Link href="/" className={ctaSecondaryClass}>
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Workspace or board creation failed (e.g. RLS, DB error). */
export function TasksWorkspaceCreationFailed({
  message,
  hint,
  reasonCode,
  stage,
  showDebug,
}: {
  message: string;
  hint: string | null;
  reasonCode?: string;
  stage?: string;
  showDebug?: boolean;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">Tasks</h1>
      <div className={cardClass}>
        <div className="flex justify-center mb-4">
          <Wrench className="h-12 w-12 text-amber-500 dark:text-amber-400" aria-hidden />
        </div>
        <h2 className={headlineClass}>We couldn’t create your task board</h2>
        <p className="text-[var(--crm-foreground)] font-medium mb-2">{message}</p>
        {hint && <p className={bodyClass}>{hint}</p>}
        {showDebug && (reasonCode || stage) && (
          <p className="text-xs font-mono text-[var(--crm-muted)] mb-4 p-2 rounded bg-[var(--crm-bg)]">
            Debug: reason={reasonCode ?? "—"} stage={stage ?? "—"}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link href="/tasks" className={ctaPrimaryClass}>
            Try again
          </Link>
          <span className="text-sm text-[var(--crm-muted)]">or sign out and back in, then open Tasks again.</span>
        </div>
        <p className="text-xs text-[var(--crm-muted)] mt-6">
          If the problem continues, contact support.
        </p>
      </div>
    </div>
  );
}
