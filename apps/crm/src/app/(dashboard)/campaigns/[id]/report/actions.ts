"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { getCampaignReportData, reportRowsForExport } from "@/lib/report";

function escapeCsvCell(v: string | number): string {
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Build CSV string from report export rows. Uses same data as report page;
 * when campaign is finalized, contribution is already approved-only (final share).
 */
export async function getReportCsvAction(
  campaignId: string
): Promise<{ error?: string; csv?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const data = await getCampaignReportData(supabase, campaignId);
  if (!data) return { error: "Campaign not found or access denied" };

  const rows = reportRowsForExport(data);
  const header = "Section,Label,Value";
  const lines = [header, ...rows.map((r) => `${escapeCsvCell(r.section)},${escapeCsvCell(r.label)},${escapeCsvCell(r.value)}`)];

  return { csv: lines.join("\r\n") };
}
