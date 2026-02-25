/**
 * Create a notification (use from API routes with service role).
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

export type NotificationType =
  | "connection_request"
  | "connection_accepted"
  | "ambassador_invite"
  | "ambassador_invite_accepted"
  | "ambassador_removed"
  | "affiliate_invite"
  | "affiliate_invite_accepted"
  | "affiliate_removed"
  | "application_submitted"
  | "application_accepted"
  | "application_rejected"
  | "deal_delivered"
  | "deal_accepted"
  | "deal_completed"
  | "speaker_request_created"
  | "speaker_request_approved"
  | "speaker_request_rejected";

const DEDUP_WINDOW_MINUTES = 5;

export async function createNotification(
  recipient_profile_id: string,
  type: NotificationType,
  opts: { entity_type?: string; entity_id?: string; payload?: Record<string, unknown> }
): Promise<void> {
  if (!supabaseUrl || !serviceKey) return;
  const supabase = createClient(supabaseUrl, serviceKey);
  const entityId = typeof opts.entity_id === "string" ? opts.entity_id.trim() || null : null;
  if (entityId) {
    const windowStart = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("recipient_profile_id", recipient_profile_id)
      .eq("type", type)
      .eq("entity_id", entityId)
      .gte("created_at", windowStart)
      .limit(1);
    if (existing && existing.length > 0) return;
  }
  await supabase.from("notifications").insert({
    recipient_profile_id,
    type,
    entity_type: opts.entity_type ?? null,
    entity_id: entityId ?? opts.entity_id ?? null,
    payload: opts.payload ?? {},
  });
}
