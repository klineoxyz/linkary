# QA seeds (manual / local / staging)

These files are **not** applied by `supabase db push`. They exist for **operator-controlled** testing.

## CRM: multi-user participant contribution

**Path chosen:** small **TypeScript seed script** (`apps/crm/scripts/seedMultiUserContributionQa.ts`) using the **service role** key, plus this README.

**Why:** avoids shipping a migration that could touch production; no raw `auth.users` inserts; reproducible **fixed UUIDs** for campaign/board/tasks/subs; idempotent cleanup of the same IDs; uses real `profiles` you already have.

### Prerequisites

- Three **distinct** profile UUIDs for participants (`CRM_QA_P1`, `CRM_QA_P2`, `CRM_QA_P3`).
- One **operator** profile UUID (`CRM_QA_OPERATOR_PROFILE_ID`) that will own the workspace and should match the user you log into the CRM as.
- `CRM_QA_SERVICE_ROLE_KEY` — Supabase **service_role** secret (local or staging only; never commit).

### Env (e.g. `apps/crm/.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
CRM_QA_SERVICE_ROLE_KEY=eyJ...
CRM_QA_OPERATOR_PROFILE_ID=<uuid>
CRM_QA_P1=<uuid>
CRM_QA_P2=<uuid>
CRM_QA_P3=<uuid>
```

### Run

From repo root:

```bash
pnpm qa:crm:multi-user-contribution
```

Or from `apps/crm`:

```bash
pnpm seed:qa:multi-user-contribution
```

### Fixed campaign URL

- Campaign id: `00000000-0000-4000-8000-00000000ca01`
- Report: `/campaigns/00000000-0000-4000-8000-00000000ca01/report`
- Workspace slug: `qa-multi-user-contribution-ca01`

### Seeded matrix (deterministic)

| Participant | Submissions | Task status | Expected proof share % (3 approved rows) | Expected task % (2× weekly_post approved) |
|-------------|-------------|-------------|--------------------------------------------|---------------------------------------------|
| P1 | 2 × **approved** | **approved** | 66.7% | ~50% |
| P2 | 1 × **approved** | **approved** | 33.3% | ~50% |
| P3 | 1 × **rejected**, 1 × **pending** | **submitted** | 0% | 0% (task not completed) |

### Where to verify

1. **Campaign detail** — `/campaigns/00000000-0000-4000-8000-00000000ca01` (loads `writeContribution` when you are workspace member).
2. **Report** — section **B** reconciliation: approved counts sum **3**, match campaign total; proof-share column sum ≈ **100%** (0.1 rounding gap OK).
3. **Section C** — three rows; P1 shows two approved, latest URLs; P3 shows rejected/pending counts.
4. **Section D** — leaderboards: P1/P2 on approved-based boards; task % leaderboard top two ~50% (cap 10 rows).
5. **Recompute from proofs** — should be a no-op for P1/P2 (tasks already approved); safe to run anyway.

### Optional stale test

After seeding, in SQL editor set `crm_tasks.status` for P1’s task to `submitted` while submissions stay `approved`. Run **Recompute from proofs** on campaign or report; task should return to **approved** and stored contribution % refresh.

### Cleanup

Re-run the script (it deletes by fixed IDs first) or delete campaign `00000000-0000-4000-8000-00000000ca01` and related rows in dependency order.
