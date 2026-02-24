/**
 * Create a notification (use from API routes with service role).
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

export type NotificationType =
  | "connection_request"
  | "ambassador_invite"
  | "affiliate_invite"
  | "application_submitted"
  | "application_accepted"
  | "application_rejected"
  | "deal_delivered"
  | "deal_accepted"
  | "deal_completed";

export async function createNotification(
  recipient_profile_id: string,
  type: NotificationType,
  opts: { entity_type?: string; entity_id?: string; payload?: Record<string, unknown> }
): Promise<void> {
  if (!supabaseUrl || !serviceKey) return;
  const supabase = createClient(supabaseUrl, serviceKey);
  await supabase.from("notifications").insert({
    recipient_profile_id,
    type,
    entity_type: opts.entity_type ?? null,
    entity_id: opts.entity_id ?? null,
    payload: opts.payload ?? {},
  });
}
