/**
 * GET /api/xspaces/reputation — read-only reputation summary for current user.
 * Reuses /api/xspaces/analytics data; adds approved_speakers_total for host.
 * Counts and rates only; no PII, no messages, pitches, or wallets.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const origin = request.nextUrl?.origin ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const analyticsRes = await fetch(`${origin}/api/xspaces/analytics`, {
    headers: { Authorization: authHeader ?? `Bearer ${token}` },
    cache: "no-store",
  });
  if (!analyticsRes.ok) {
    if (analyticsRes.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Analytics unavailable" }, { status: 502 });
  }
  const analytics = (await analyticsRes.json().catch(() => null)) as {
    host?: { hosted_spaces?: number; sponsor_proposals_received?: number; sponsor_proposals_accepted?: number; sponsor_proposals_declined?: number; sponsor_acceptance_rate?: number | null };
    speaker?: { applications?: number; approved?: number; declined?: number; withdrawn?: number; approval_rate?: number | null };
    project?: { proposals_sent?: number; proposals_accepted?: number; proposals_declined?: number; proposals_pending?: number; acceptance_rate?: number | null };
  } | null;
  if (!analytics?.host || !analytics?.speaker || !analytics?.project) {
    return NextResponse.json({ error: "Invalid analytics response" }, { status: 502 });
  }

  let approved_speakers_total = 0;
  if (analytics.host.hosted_spaces && analytics.host.hosted_spaces > 0) {
    const { data: mySpaces } = await supabase.from("spaces").select("id").eq("host_profile_id", user.id);
    const spaceIds = (mySpaces ?? []).map((s: { id: string }) => s.id);
    if (spaceIds.length > 0) {
      const { count } = await supabase
        .from("speaker_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .in("space_id", spaceIds);
      approved_speakers_total = typeof count === "number" ? count : 0;
    }
  }

  return NextResponse.json({
    speaker: {
      applications_total: analytics.speaker.applications ?? 0,
      approved_total: analytics.speaker.approved ?? 0,
      declined_total: analytics.speaker.declined ?? 0,
      withdrawn_total: analytics.speaker.withdrawn ?? 0,
      approval_rate: analytics.speaker.approval_rate ?? null,
    },
    sponsor: {
      proposals_total: analytics.project.proposals_sent ?? 0,
      accepted_total: analytics.project.proposals_accepted ?? 0,
      declined_total: analytics.project.proposals_declined ?? 0,
      pending_total: analytics.project.proposals_pending ?? 0,
      acceptance_rate: analytics.project.acceptance_rate ?? null,
    },
    host: {
      hosted_spaces_total: analytics.host.hosted_spaces ?? 0,
      sponsor_proposals_received: analytics.host.sponsor_proposals_received ?? 0,
      sponsor_proposals_accepted: analytics.host.sponsor_proposals_accepted ?? 0,
      sponsor_proposals_declined: analytics.host.sponsor_proposals_declined ?? 0,
      sponsor_acceptance_rate: analytics.host.sponsor_acceptance_rate ?? null,
      approved_speakers_total,
    },
  });
}
