import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { enqueueInfluenceRefresh } from "@/lib/refreshOrgInfluence";

const BATCH_SIZE = 50;

/** Daily cron: refresh org influence rollups for all orgs. Safe retry; logs progress and duration.
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const start = Date.now();
  let offset = 0;
  let totalProcessed = 0;
  let success = 0;
  let errors = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: orgs, error: listError } = await supabase
      .from("orgs")
      .select("id")
      .range(offset, offset + BATCH_SIZE - 1)
      .order("created_at", { ascending: true });

    if (listError) {
      return NextResponse.json(
        { error: listError.message, processed: totalProcessed, success, errors },
        { status: 500 }
      );
    }
    const batch = (orgs ?? []) as Array<{ id: string }>;
    if (batch.length === 0) break;

    for (const org of batch) {
      try {
        await enqueueInfluenceRefresh(org.id);
        success += 1;
      } catch (e) {
        console.warn("[sync-org-influence-daily]", org.id, e);
        errors += 1;
      }
      totalProcessed += 1;
    }

    if (batch.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  const durationMs = Date.now() - start;
  console.log(
    `[sync-org-influence-daily] done processed=${totalProcessed} success=${success} errors=${errors} durationMs=${durationMs}`
  );
  return NextResponse.json({
    ok: true,
    processed: totalProcessed,
    success,
    errors,
    durationMs,
  });
}
