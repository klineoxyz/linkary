/**
 * Deals: list, get. Creation is via POST /api/applications/[id]/accept (org accepts → creates deal).
 */
import { supabase } from "./supabase";

export type Deal = {
  id: string;
  profile_id: string;
  org_id: string;
  job_id: string | null;
  application_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
};

/** List deals where current user is profile or org member (RLS). */
export async function listMyDeals(): Promise<Deal[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("id, profile_id, org_id, job_id, application_id, status, created_at, updated_at, delivered_at, accepted_at, completed_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Deal[];
}

/** Get single deal by id (RLS: party only). */
export async function getDeal(id: string): Promise<Deal | null> {
  const { data, error } = await supabase
    .from("deals")
    .select("id, profile_id, org_id, job_id, application_id, status, created_at, updated_at, delivered_at, accepted_at, completed_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Deal;
}
