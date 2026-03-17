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
  searchParams: Promise<{ filter?: string; campaign?: string }>;
}) {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) redirect("/login");

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
        const { message, hint } = workspaceBootstrapMessage("no_profile");
        return <TasksNoProfile message={message} hint={hint} />;
      }
      profileRow = { id: user.id, profile_type: CREATOR_BOOTSTRAP_PROFILE_TYPE } as { id: string; profile_type: string };
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
    const { message, hint } = workspaceBootstrapMessage(reason);
    return <TasksWorkspaceCreationFailed message={message} hint={hint} />;
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

  return (
    <div className="space-y-6">
      {isEmpty && (
        <div className="rounded-xl border border-[var(--crm-primary)]/20 bg-[var(--crm-card)] p-6">
          <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-1">You&apos;re all set</h2>
          <p className="text-sm text-[var(--crm-muted)]">
            Your personal task board is ready. Add tasks to track your work, or wait for campaign tasks to appear when you&apos;re in a campaign.
          </p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">Tasks</h1>
        <CreateTaskButton />
      </div>
      <MyCampaignBundles bundles={myBundles} currentCampaignId={campaignId} />
      <TasksFilters campaignId={campaignId} campaignTitle={campaignTitle} />
      <TasksList tasks={tasks} emptyStateCTA={isEmpty ? <CreateTaskButton /> : undefined} />
    </div>
  );
}
