/**
 * P0: Client cache — auth-aware fetcher for SWR.
 * Use with useSWR(key, authFetcher, { dedupingInterval: 60000 }) to avoid duplicate fetches
 * when navigating Profile → Analytics.
 */
import { supabase } from "./supabase";

export const SWR_DEDUP_MS = 60_000; // 60s stale window

export async function authFetcher(url: string): Promise<unknown> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("No session");
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}
