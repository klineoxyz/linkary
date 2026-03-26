/**
 * Deterministic CRM multi-user contribution QA seed (service role).
 *
 * Env (apps/crm/.env.local or process env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   CRM_QA_SERVICE_ROLE_KEY — Supabase service_role key (never commit; staging/local only)
 *   CRM_QA_OPERATOR_PROFILE_ID — workspace owner (use your logged-in CRM operator profile id)
 *   CRM_QA_P1, CRM_QA_P2, CRM_QA_P3 — three distinct existing profile UUIDs (can include operator as one participant)
 *
 * Run:
 *   pnpm --filter crm exec tsx scripts/seedMultiUserContributionQa.ts
 *
 * Fixed IDs allow idempotent cleanup + docs to reference one campaign URL:
 *   /campaigns/00000000-0000-4000-8000-00000000ca01/report
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const IDS = {
  workspace: "00000000-0000-4000-8000-00000000ca02",
  board: "00000000-0000-4000-8000-00000000ca03",
  campaign: "00000000-0000-4000-8000-00000000ca01",
  bundleP1: "00000000-0000-4000-8000-00000000ca11",
  bundleP2: "00000000-0000-4000-8000-00000000ca12",
  bundleP3: "00000000-0000-4000-8000-00000000ca13",
  taskP1: "00000000-0000-4000-8000-00000001ca11",
  taskP2: "00000000-0000-4000-8000-00000001ca12",
  taskP3: "00000000-0000-4000-8000-00000001ca13",
  subP1a: "00000000-0000-4000-8000-00000002ca01",
  subP1b: "00000000-0000-4000-8000-00000002ca02",
  subP2: "00000000-0000-4000-8000-00000002ca03",
  subP3rej: "00000000-0000-4000-8000-00000002ca04",
  subP3pend: "00000000-0000-4000-8000-00000002ca05",
} as const;

const WORKSPACE_SLUG = "qa-multi-user-contribution-ca01";

function loadDotEnvFile() {
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "..", "..", ".env.local"),
  ];
  const p = candidates.find((f) => existsSync(f));
  if (!p) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

async function main() {
  loadDotEnvFile();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("CRM_QA_SERVICE_ROLE_KEY");
  const operatorId = requireEnv("CRM_QA_OPERATOR_PROFILE_ID");
  const p1 = requireEnv("CRM_QA_P1");
  const p2 = requireEnv("CRM_QA_P2");
  const p3 = requireEnv("CRM_QA_P3");
  for (const [k, v] of Object.entries({ operatorId, p1, p2, p3 })) {
    if (!isUuid(v)) throw new Error(`Invalid UUID for ${k}: ${v}`);
  }
  const profiles = new Set([p1, p2, p3]);
  if (profiles.size !== 3) throw new Error("CRM_QA_P1, P2, P3 must be three distinct profile UUIDs");

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Cleaning any prior QA rows (fixed IDs)…");
  await supabase.from("crm_submissions").delete().eq("campaign_id", IDS.campaign);
  await supabase.from("crm_tasks").delete().eq("campaign_id", IDS.campaign);
  await supabase.from("crm_task_bundles").delete().eq("campaign_id", IDS.campaign);
  await supabase.from("crm_campaign_participants").delete().eq("campaign_id", IDS.campaign);
  await supabase.from("crm_campaigns").delete().eq("id", IDS.campaign);
  await supabase.from("crm_boards").delete().eq("id", IDS.board);
  await supabase.from("crm_workspace_members").delete().eq("workspace_id", IDS.workspace);
  await supabase.from("crm_workspaces").delete().eq("id", IDS.workspace);

  console.log("Inserting workspace, board, campaign, bundles, tasks, participants, submissions…");

  const { error: wsErr } = await supabase.from("crm_workspaces").insert({
    id: IDS.workspace,
    type: "org",
    slug: WORKSPACE_SLUG,
    name: "QA — multi-user contribution",
    owner_profile_id: operatorId,
    updated_at: new Date().toISOString(),
  });
  if (wsErr) throw new Error(`crm_workspaces: ${wsErr.message}`);

  const memberMap = new Map<string, "owner" | "member">();
  memberMap.set(operatorId, "owner");
  for (const pid of [p1, p2, p3]) {
    if (!memberMap.has(pid)) memberMap.set(pid, "member");
  }
  const members = [...memberMap.entries()].map(([profile_id, role]) => ({
    workspace_id: IDS.workspace,
    profile_id,
    role,
  }));
  const { error: memErr } = await supabase.from("crm_workspace_members").upsert(members, {
    onConflict: "workspace_id,profile_id",
  });
  if (memErr) throw new Error(`crm_workspace_members: ${memErr.message}`);

  const { error: bErr } = await supabase.from("crm_boards").insert({
    id: IDS.board,
    workspace_id: IDS.workspace,
    name: "QA campaign board",
    kind: "campaign",
  });
  if (bErr) throw new Error(`crm_boards: ${bErr.message}`);

  const { error: cErr } = await supabase.from("crm_campaigns").insert({
    id: IDS.campaign,
    workspace_id: IDS.workspace,
    title: "QA — multi-user contribution (seeded)",
    description:
      "Deterministic seed for participant table, proof share %, task %, reconciliation. Safe to delete.",
    status: "active",
    updated_at: new Date().toISOString(),
  });
  if (cErr) throw new Error(`crm_campaigns: ${cErr.message}`);

  const now = new Date().toISOString();
  const participants = [p1, p2, p3].map((participant_profile_id) => ({
    campaign_id: IDS.campaign,
    participant_profile_id,
    role: "contributor",
    status: "accepted",
    accepted_at: now,
  }));
  const { error: partErr } = await supabase.from("crm_campaign_participants").insert(participants);
  if (partErr) throw new Error(`crm_campaign_participants: ${partErr.message}`);

  const bundles = [
    { id: IDS.bundleP1, participant_profile_id: p1, title: "QA bundle P1" },
    { id: IDS.bundleP2, participant_profile_id: p2, title: "QA bundle P2" },
    { id: IDS.bundleP3, participant_profile_id: p3, title: "QA bundle P3" },
  ];
  for (const b of bundles) {
    const { error } = await supabase.from("crm_task_bundles").insert({
      id: b.id,
      workspace_id: IDS.workspace,
      campaign_id: IDS.campaign,
      participant_profile_id: b.participant_profile_id,
      title: b.title,
      expected_task_count: 1,
      completed_task_count: 0,
    });
    if (error) throw new Error(`crm_task_bundles: ${error.message}`);
  }

  const tasks = [
    {
      id: IDS.taskP1,
      task_bundle_id: IDS.bundleP1,
      assigned_to: p1,
      status: "approved",
      title: "QA weekly post P1",
    },
    {
      id: IDS.taskP2,
      task_bundle_id: IDS.bundleP2,
      assigned_to: p2,
      status: "approved",
      title: "QA weekly post P2",
    },
    {
      id: IDS.taskP3,
      task_bundle_id: IDS.bundleP3,
      assigned_to: p3,
      status: "submitted",
      title: "QA weekly post P3",
    },
  ];
  for (const t of tasks) {
    const { error } = await supabase.from("crm_tasks").insert({
      id: t.id,
      workspace_id: IDS.workspace,
      board_id: IDS.board,
      campaign_id: IDS.campaign,
      task_bundle_id: t.task_bundle_id,
      source_type: "org_manual",
      title: t.title,
      status: t.status,
      deliverable_type: "weekly_post",
      created_by: operatorId,
      assigned_to: t.assigned_to,
      updated_at: now,
    });
    if (error) throw new Error(`crm_tasks: ${error.message}`);
  }

  const submissions = [
    {
      id: IDS.subP1a,
      task_id: IDS.taskP1,
      participant_profile_id: p1,
      url: "https://example.com/qa-proof/p1-a",
      status: "approved",
      reviewed_at: now,
    },
    {
      id: IDS.subP1b,
      task_id: IDS.taskP1,
      participant_profile_id: p1,
      url: "https://example.com/qa-proof/p1-b",
      status: "approved",
      reviewed_at: now,
    },
    {
      id: IDS.subP2,
      task_id: IDS.taskP2,
      participant_profile_id: p2,
      url: "https://example.com/qa-proof/p2",
      status: "approved",
      reviewed_at: now,
    },
    {
      id: IDS.subP3rej,
      task_id: IDS.taskP3,
      participant_profile_id: p3,
      url: "https://example.com/qa-proof/p3-rejected",
      status: "rejected",
      reviewed_at: now,
      rejection_reason: "QA seed",
    },
    {
      id: IDS.subP3pend,
      task_id: IDS.taskP3,
      participant_profile_id: p3,
      url: "https://example.com/qa-proof/p3-pending",
      status: "pending",
    },
  ];

  for (const s of submissions) {
    const { error } = await supabase.from("crm_submissions").insert({
      id: s.id,
      task_id: s.task_id,
      campaign_id: IDS.campaign,
      participant_profile_id: s.participant_profile_id,
      platform: "x",
      url: s.url,
      status: s.status,
      reviewed_at: s.reviewed_at ?? null,
      rejection_reason: s.rejection_reason ?? null,
      updated_at: now,
    });
    if (error) throw new Error(`crm_submissions: ${error.message}`);
  }

  console.log("\nDone.");
  console.log(`Campaign ID: ${IDS.campaign}`);
  console.log(`CRM report:  /campaigns/${IDS.campaign}/report`);
  console.log(`Workspace slug: ${WORKSPACE_SLUG} (log in as operator profile ${operatorId})`);
  console.log("\nExpected matrix:");
  console.log("  P1: 2 approved subs, task approved → proof share 66.7%, task % ~50%");
  console.log("  P2: 1 approved sub, task approved → proof share 33.3%, task % ~50%");
  console.log("  P3: 1 rejected + 1 pending, task submitted → proof share 0%, task % 0%");
  console.log("  Approved proof rows campaign total: 3; reconciliation sum of approved counts = 3");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
