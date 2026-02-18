/**
 * Conversations and messages. Participants as jsonb [{ type, id }].
 */
import { supabase } from "./supabase";

export type Participant = { type: "profile" | "org"; id: string };

export type Conversation = {
  id: string;
  participants: Participant[];
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_type: "profile" | "org";
  sender_profile_id: string | null;
  sender_org_id: string | null;
  body: string;
  created_at: string;
};

const CONVERSATIONS = "conversations";
const MESSAGES = "messages";

function normalizeParticipants(participants: Participant[]): Participant[] {
  return [...participants].sort((a, b) => {
    const key = (p: Participant) => p.type + ":" + p.id;
    return key(a).localeCompare(key(b));
  });
}

function participantsMatch(a: Participant[], b: Participant[]): boolean {
  const na = normalizeParticipants(a);
  const nb = normalizeParticipants(b);
  if (na.length !== nb.length) return false;
  return na.every((p, i) => p.type === nb[i].type && p.id === nb[i].id);
}

/** Find existing conversation with same participants (order-insensitive) or create. */
export async function getOrCreateConversation(
  participants: Participant[]
): Promise<{ data: Conversation | null; error: string | null }> {
  if (participants.length === 0) return { data: null, error: "participants required" };
  const normalized = normalizeParticipants(participants);
  const participantsJson = JSON.stringify(normalized);

  const { data: list, error: listErr } = await supabase.from(CONVERSATIONS).select("*");
  if (listErr) return { data: null, error: listErr.message };

  const existing = (list ?? []).find((row: { participants: unknown }) => {
    const p = typeof row.participants === "string" ? JSON.parse(row.participants) : row.participants;
    return participantsMatch(Array.isArray(p) ? p : [], normalized);
  });
  if (existing) {
    const p = typeof existing.participants === "string" ? JSON.parse(existing.participants) : existing.participants;
    return { data: { ...existing, participants: Array.isArray(p) ? p : [] } as Conversation, error: null };
  }

  const { data: created, error: createErr } = await supabase
    .from(CONVERSATIONS)
    .insert({ participants: participantsJson })
    .select()
    .single();
  if (createErr) return { data: null, error: createErr.message };
  return { data: { ...created, participants: normalized } as Conversation, error: null };
}

/** List conversations where user participates (as profile or as member of an org in participants). */
export async function listConversationsForUser(userId: string): Promise<Conversation[]> {
  const { data: members } = await supabase.from("org_members").select("org_id").eq("user_id", userId);
  const orgIds = (members ?? []).map((m: { org_id: string }) => m.org_id);

  const { data: rows, error } = await supabase.from(CONVERSATIONS).select("*").order("updated_at", { ascending: false });
  if (error) return [];

  const out: Conversation[] = [];
  for (const row of rows ?? []) {
    const p = typeof row.participants === "string" ? JSON.parse(row.participants) : row.participants;
    const parts = Array.isArray(p) ? p : [];
    const hasUser =
      parts.some((x: Participant) => x.type === "profile" && x.id === userId) ||
      parts.some((x: Participant) => x.type === "org" && orgIds.includes(x.id));
    if (hasUser) out.push({ ...row, participants: parts } as Conversation);
  }
  return out;
}

/** List messages for a conversation. */
export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from(MESSAGES)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as Message[];
}

/** Send message as profile. */
export async function sendMessageAsProfile(
  conversationId: string,
  profileId: string,
  body: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(MESSAGES).insert({
    conversation_id: conversationId,
    sender_type: "profile",
    sender_profile_id: profileId,
    sender_org_id: null,
    body: body.trim(),
  });
  if (error) return { error: error.message };
  await supabase.from(CONVERSATIONS).update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  return { error: null };
}

/** Send message as org. */
export async function sendMessageAsOrg(
  conversationId: string,
  orgId: string,
  body: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(MESSAGES).insert({
    conversation_id: conversationId,
    sender_type: "org",
    sender_profile_id: null,
    sender_org_id: orgId,
    body: body.trim(),
  });
  if (error) return { error: error.message };
  await supabase.from(CONVERSATIONS).update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  return { error: null };
}
