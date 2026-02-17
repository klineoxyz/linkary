import { supabase } from "./supabase";

export type WalletRow = {
  id: string;
  user_id: string;
  chain: string;
  address: string;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

const WALLETS = "wallets";

export function validateEVMAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

export function validateSolanaAddress(address: string): boolean {
  const a = address.trim();
  return a.length >= 32 && a.length <= 44;
}

/** Fetch wallets for a user (client-safe; RLS allows public select). */
export async function getWalletsByUserId(userId: string): Promise<WalletRow[]> {
  const { data, error } = await supabase
    .from(WALLETS)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WalletRow[];
}

export type UpsertWalletResult = { ok: true } | { ok: false; error: string };

/**
 * Upsert one wallet per chain for the current user.
 * - If a row exists for (user_id, chain), update address and set is_primary=true.
 * - Otherwise insert with is_primary=true.
 * - Unsets is_primary for other rows of the same user_id and chain.
 * Caller must be authenticated (RLS enforces user_id = auth.uid()).
 */
export async function upsertWallet(
  userId: string,
  chain: "evm" | "solana",
  address: string
): Promise<UpsertWalletResult> {
  const trimmed = address.trim();
  if (chain === "evm") {
    if (!validateEVMAddress(trimmed))
      return { ok: false, error: "EVM address must start with 0x and be 42 characters." };
  } else {
    if (!validateSolanaAddress(trimmed))
      return { ok: false, error: "Solana address must be 32–44 characters." };
  }

  const { data: existing } = await supabase
    .from(WALLETS)
    .select("id")
    .eq("user_id", userId)
    .eq("chain", chain)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error: unsetError } = await supabase
      .from(WALLETS)
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("chain", chain)
      .neq("id", existing.id);

    if (unsetError) return { ok: false, error: unsetError.message };

    const { error: updateError } = await supabase
      .from(WALLETS)
      .update({ address: trimmed, is_primary: true })
      .eq("id", existing.id);

    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true };
  }

  const { error: insertError } = await supabase.from(WALLETS).insert({
    user_id: userId,
    chain,
    address: trimmed,
    is_primary: true,
  });

  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true };
}
