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

  const [tasks, myBundles, allBoardTasks] = await Promise.all([
    fetchTasks(supabase, ws.boardId, filter, campaignId ? { campaignId } : undefined),
    fetchMyCampaignBundles(supabase, user.id),
    fetchTasks(supabase, ws.boardId, "all", undefined),
  ]);

  const campaignTitle =
    campaignId && myBundles.find((b) => b.campaignId === campaignId)
      ? myBundles.find((b) => b.campaignId === campaignId)!.campaignTitle
      : null;

  const isBoardEmpty = allBoardTasks.length === 0;
  const enrolledInFilteredCampaign =
    !!campaignId && myBundles.some((b) => b.campaignId === campaignId);
  const manualCount = tasks.filter((t) => t.source_type === "manual").length;
  const campaignCount = tasks.filter((t) => t.source_type !== "manual").length;

  return (
    <div className="space-y-8">
      {/* Workspace hero / summary */}
      <header className="crm-surface-raised px-4 py-5 sm:px-6 sm:py-6 rounded-[var(--crm-radius)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="crm-page-title">Your workspace</h1>
            <p className="crm-page-subtitle mt-0 max-w-none">
              Tasks from accepted work on Linkary appear here, grouped by campaign. Counted delivery is when you{" "}
              <strong className="text-[var(--crm-foreground)]">submit proof from this task board</strong> (stored as submissions)—applying
              alone does not complete work.
            </p>
          </div>
          <div className="shrink-0">
            <CreateTaskButton />
          </div>
        </div>
      </header>

      {isBoardEmpty && (
        <section className="crm-surface-muted border-[var(--crm-primary)]/25 shadow-[var(--crm-shadow-sm)] ring-1 ring-inset ring-[var(--crm-primary)]/15 p-5 sm:p-7 rounded-[var(--crm-radius)]">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--crm-primary)] mb-2">
              {myBundles.length > 0 ? "Almost there" : "Setup complete"}
            </p>
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--crm-foreground)] mb-2">
              {myBundles.length > 0
                ? "You’re on a campaign — tasks may still be syncing"
                : "No tasks yet — here’s what to expect"}
            </h2>
            <p className="text-sm text-[var(--crm-muted)] mb-4">
              <strong className="text-[var(--crm-foreground)]">Campaign tasks</strong> are created when you accept work on Linkary. They usually appear in CRM within a few minutes (same account). If nothing shows after ~10 minutes, confirm the deal was accepted on Linkary, then refresh.
            </p>
            {myBundles.length === 0 && (
              <p className="text-sm text-[var(--crm-muted)] mb-6">
                Add <strong className="text-[var(--crm-foreground)]">personal tasks</strong> anytime to track your own to-dos.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <CreateTaskButton />
            </div>
          </div>
        </section>
      )}

      <MyCampaignBundles bundles={myBundles} currentCampaignId={campaignId} />

      {/* Tasks section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-[var(--crm-foreground)]">
            {tasks.length > 0 ? "All tasks" : "Task list"}
          </h2>
          {tasks.length > 0 && (
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
          emptyStateCTA={isBoardEmpty ? <CreateTaskButton /> : undefined}
          isBoardTotallyEmpty={isBoardEmpty}
          campaignFilterActive={!!campaignId}
          enrolledInFilteredCampaign={enrolledInFilteredCampaign}
        />
      </section>
    </div>
  );
}
