import { supabase } from "./supabase";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  twitter_username: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Wallet = {
  id: string;
  user_id: string;
  chain: string;
  address: string;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

const PROFILES = "profiles";
const WALLETS = "wallets";

export async function getProfileByUsername(
  username: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from(PROFILES)
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function getWalletsByUserId(userId: string): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from(WALLETS)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Wallet[];
}
