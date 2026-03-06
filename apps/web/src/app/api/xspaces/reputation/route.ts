/**
 * GET /api/xspaces/reputation — read-only reputation summary for current user.
 * Uses shared xspaces-stats helper (no internal fetch to analytics).
 * Counts and rates only; no PII, no messages, pitches, or wallets.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getXSpacesAnalytics, getApprovedSpeakersTotal } from "@/lib/xspaces-stats";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const [analytics, approved_speakers_total] = await Promise.all([
    getXSpacesAnalytics(supabase, user.id),
    getApprovedSpeakersTotal(supabase, user.id),
  ]);

  return NextResponse.json({
    speaker: {
      applications_total: analytics.speaker.applications,
      approved_total: analytics.speaker.approved,
      declined_total: analytics.speaker.declined,
      withdrawn_total: analytics.speaker.withdrawn,
      approval_rate: analytics.speaker.approval_rate,
    },
    sponsor: {
      proposals_total: analytics.project.proposals_sent,
      accepted_total: analytics.project.proposals_accepted,
      declined_total: analytics.project.proposals_declined,
      pending_total: analytics.project.proposals_pending,
      acceptance_rate: analytics.project.acceptance_rate,
    },
    host: {
      hosted_spaces_total: analytics.host.hosted_spaces,
      sponsor_proposals_received: analytics.host.sponsor_proposals_received,
      sponsor_proposals_accepted: analytics.host.sponsor_proposals_accepted,
      sponsor_proposals_declined: analytics.host.sponsor_proposals_declined,
      sponsor_acceptance_rate: analytics.host.sponsor_acceptance_rate,
      approved_speakers_total,
    },
  });
}
