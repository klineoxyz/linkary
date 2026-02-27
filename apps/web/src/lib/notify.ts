/**
 * Email notification helpers (server-only).
 * - Rate limit via notification_log.
 * - Send via Resend. Env: RESEND_API_KEY, EMAIL_FROM.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const DEFAULT_WINDOW_MINUTES = 10;

/**
 * Returns true if we are allowed to send this notification type to this user
 * (no row in notification_log within the last windowMinutes).
 */
export async function canSend(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  windowMinutes: number = DEFAULT_WINDOW_MINUTES
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("notification_log")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", since)
    .limit(1);
  if (error) return false;
  return !data || data.length === 0;
}

/**
 * Record that we sent this notification (for rate limiting).
 */
export async function logSent(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  refId: string | null
): Promise<void> {
  await supabase.from("notification_log").insert({
    user_id: userId,
    type,
    ref_id: refId,
  });
}

export type SendCollabRequestEmailParams = {
  toEmail: string;
  targetUsername: string | null;
  requesterName: string;
  requesterUsername: string;
  messagePreview: string;
  category: string | null;
  budgetText: string | null;
  inboxUrl: string;
};

/**
 * Send "New collaboration request" email via Resend.
 * Returns { ok: true } on success, { ok: false, error } on failure.
 */
export async function sendCollabRequestEmail(
  params: SendCollabRequestEmailParams
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false, error: "RESEND_API_KEY or EMAIL_FROM not set" };
  }

  const {
    toEmail,
    targetUsername,
    requesterName,
    requesterUsername,
    messagePreview,
    category,
    budgetText,
    inboxUrl,
  } = params;

  const handle = requesterUsername ? `@${requesterUsername}` : "";
  const nameLine = requesterName ? `${requesterName} ${handle}`.trim() : handle || "Someone";
  const meta: string[] = [];
  if (category) meta.push(`Category: ${category}`);
  if (budgetText) meta.push(`Budget: ${budgetText}`);
  const metaBlock = meta.length ? `<p style="margin:8px 0;color:#555;">${meta.join(" · ")}</p>` : "";
  const preview = messagePreview.slice(0, 160) + (messagePreview.length > 160 ? "…" : "");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#333;max-width:560px;">
  <p>Hi${targetUsername ? ` ${targetUsername}` : ""},</p>
  <p><strong>${escapeHtml(nameLine)}</strong> sent you a new collaboration request on Linkary.</p>
  ${metaBlock}
  <p style="margin:12px 0;padding:12px;background:#f5f5f5;border-radius:8px;">${escapeHtml(preview)}</p>
  <p>
    <a href="${escapeHtml(inboxUrl)}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">View request</a>
  </p>
  <p style="margin-top:24px;font-size:13px;color:#888;">This email was sent by Linkary. You received it because someone requested to collaborate with you.</p>
</body>
</html>`;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [toEmail],
      subject: "New collaboration request on Linkary",
      html,
    });
    if (error) return { ok: false, error: error.message };
    if (data?.id) return { ok: true };
    return { ok: false, error: "No id returned from Resend" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
