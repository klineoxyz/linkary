import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { resolveCrmAccess, CREATOR_BOOTSTRAP_PROFILE_TYPE } from "@/lib/access";
import { getOrCreateCreatorWorkspaceAndBoard, workspaceBootstrapMessage } from "@/lib/workspace";
import { fetchTasks } from "@/lib/tasks";
import type { TaskFilter } from "@/lib/tasks";
import { fetchMyCampaignBundles } from "@/lib/bundles";
import { TasksList } from "./TasksList";
import { TasksFilters } from "./TasksFilters";
import { CreateTaskButton } from "./CreateTaskButton";
import { MyCampaignBundles } from "./MyCampaignBundles";
import {
  TasksNoProfile,
  TasksWrongProfileType,
  TasksWorkspaceCreationFailed,
} from "./TasksOnboarding";

const VALID_FILTERS: TaskFilter[] = [
  "all",
  "this_week",
  "overdue",
  "campaign",
  "submitted",
  "approved",
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; campaign?: string; debug?: string }>;
}) {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    redirect("/login");
  }

  const access = await resolveCrmAccess(supabase, user.id);
  const hasCreatorWorkspace = !!access.creatorWorkspace;

  if (!hasCreatorWorkspace) {
    // Missing profile → try to create minimal profile for individual (CRM-only users), then retry.
    let { data: profileRow } = await supabase
      .from("profiles")
      .select("id, profile_type")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileRow?.id) {
      const { error: insertErr } = await supabase.from("profiles").insert({
        id: user.id,
        profile_type: CREATOR_BOOTSTRAP_PROFILE_TYPE,
        published: false,
      });
      if (insertErr) {
        // Race: profile may have been created by trigger or another request (23505). Re-fetch and continue.
        if (insertErr.code === "23505") {
          const { data: refetched } = await supabase
            .from("profiles")
            .select("id, profile_type")
            .eq("id", user.id)
            .maybeSingle();
          if (refetched?.id) {
            profileRow = refetched as { id: string; profile_type: string };
          } else {
            const { message, hint } = workspaceBootstrapMessage("no_profile");
            return <TasksNoProfile message={message} hint={hint} />;
          }
        } else {
          const { message, hint } = workspaceBootstrapMessage("no_profile");
          return <TasksNoProfile message={message} hint={hint} />;
        }
      } else {
        profileRow = { id: user.id, profile_type: CREATOR_BOOTSTRAP_PROFILE_TYPE } as { id: string; profile_type: string };
      }
    }
    // Profile exists but not individual → no access to personal task board.
    const eligibleToBootstrap =
      (profileRow as { profile_type?: string }).profile_type === CREATOR_BOOTSTRAP_PROFILE_TYPE;
    if (!eligibleToBootstrap) {
      return <TasksWrongProfileType />;
    }
  }

  const wsResult = await getOrCreateCreatorWorkspaceAndBoard(supabase, user.id);
  if (!wsResult || "error" in wsResult) {
    const reason = wsResult && "error" in wsResult ? wsResult.error : "unknown";
    const stage = wsResult && "stage" in wsResult ? wsResult.stage : undefined;
    const { message, hint } = workspaceBootstrapMessage(reason);
    const params = await searchParams;
    const showDebug = params.debug === "1";
    return (
      <TasksWorkspaceCreationFailed
        message={message}
        hint={hint}
        reasonCode={reason}
        stage={stage}
        showDebug={showDebug}
      />
    );
  }
  const ws = wsResult;

  const params = await searchParams;
  const filterRaw = params.filter ?? "all";
  const filter: TaskFilter = VALID_FILTERS.includes(filterRaw as TaskFilter)
    ? (filterRaw as TaskFilter)
    : "all";
  const campaignId = params.campaign?.trim() || null;

  const [tasks, myBundles] = await Promise.all([
    fetchTasks(supabase, ws.boardId, filter, campaignId ? { campaignId } : undefined),
    fetchMyCampaignBundles(supabase, user.id),
  ]);

  const campaignTitle =
    campaignId && myBundles.find((b) => b.campaignId === campaignId)
      ? myBundles.find((b) => b.campaignId === campaignId)!.campaignTitle
      : null;

  const isEmpty = tasks.length === 0;
  const manualCount = tasks.filter((t) => t.source_type === "manual").length;
  const campaignCount = tasks.filter((t) => t.source_type !== "manual").length;

  return (
    <div className="space-y-8">
      {/* Workspace hero / summary */}
      <header className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--crm-foreground)]">
              Your workspace
            </h1>
            <p className="mt-1 text-sm text-[var(--crm-muted)]">
              Deliverables from accepted work on Linkary show up here, grouped by campaign below. X post links are supported first; other platforms follow the same flow when enabled.
            </p>
          </div>
          <CreateTaskButton />
        </div>
      </header>

      {/* First-run welcome (only when no tasks) */}
      {isEmpty && (
        <section className="rounded-2xl border-2 border-[var(--crm-primary)]/30 bg-gradient-to-b from-[var(--crm-primary)]/5 to-transparent p-8">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--crm-primary)] mb-2">
              Setup complete
            </p>
            <h2 className="text-xl font-semibold text-[var(--crm-foreground)] mb-2">
              No tasks yet — here&apos;s why
            </h2>
            <p className="text-sm text-[var(--crm-muted)] mb-4">
              <strong className="text-[var(--crm-foreground)]">Campaign tasks</strong> are created on Linkary when you accept a gig, sprint, or program slot. They sync into CRM shortly after (same login). If you just accepted, wait a minute and refresh.
            </p>
            <p className="text-sm text-[var(--crm-muted)] mb-6">
              You can also add <strong className="text-[var(--crm-foreground)]">personal tasks</strong> below to track your own to-dos.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <CreateTaskButton />
            </div>
          </div>
        </section>
      )}

      <MyCampaignBundles bundles={myBundles} currentCampaignId={campaignId} />

      {/* Tasks section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-[var(--crm-foreground)]">
            {isEmpty ? "Tasks" : "All tasks"}
          </h2>
          {!isEmpty && (
            <p className="text-sm text-[var(--crm-muted)]">
              {manualCount > 0 && campaignCount > 0
                ? `${manualCount} personal · ${campaignCount} campaign`
                : manualCount > 0
                  ? `${manualCount} personal`
                  : `${campaignCount} campaign`}
            </p>
          )}
        </div>
        <TasksFilters campaignId={campaignId} campaignTitle={campaignTitle} />
        <TasksList
          tasks={tasks}
          emptyStateCTA={isEmpty ? <CreateTaskButton /> : undefined}
          isEmpty={isEmpty}
        />
      </section>
    </div>
  );
}
