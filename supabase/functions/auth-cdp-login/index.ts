// Linkary: CDP wallet login bridge — verify signature, find/create user, return magic link token.
// Client calls supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) to get session.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/ethers@6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LINKARY_LOGIN_PREFIX = "Linkary login: ";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function normalizeAddress(a: string): string {
  return a.startsWith("0x") ? a.toLowerCase() : "0x" + a.toLowerCase();
}

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { address?: string; message?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { address: rawAddress, message, signature } = body;
  if (!rawAddress || !message || !signature) {
    return jsonResponse({ error: "Missing address, message, or signature" }, 400);
  }

  if (!message.startsWith(LINKARY_LOGIN_PREFIX)) {
    return jsonResponse({ error: "Invalid message format" }, 400);
  }

  let recovered: string;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return jsonResponse({ error: "Invalid signature" }, 400);
  }

  const address = normalizeAddress(rawAddress);
  const recoveredNorm = normalizeAddress(recovered);
  if (recoveredNorm !== address) {
    return jsonResponse({ error: "Signature does not match address" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing } = await supabase
    .from("wallet_identities")
    .select("user_id")
    .eq("address", address)
    .maybeSingle();

  let userId: string;

  if (existing?.user_id) {
    userId = existing.user_id;
  } else {
    const syntheticEmail = `${address}@wallet.linkary.xyz`;
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
    });
    if (createErr || !newUser?.user?.id) {
      console.error("createUser error:", createErr);
      return jsonResponse(
        { error: "Failed to create user: " + (createErr?.message ?? "unknown") },
        500
      );
    }
    userId = newUser.user.id;
    const { error: insertErr } = await supabase.from("wallet_identities").insert({
      user_id: userId,
      address,
    });
    if (insertErr) {
      console.error("wallet_identities insert error:", insertErr);
      return jsonResponse({ error: "Failed to link wallet" }, 500);
    }
  }

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: `${address}@wallet.linkary.xyz`,
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("generateLink error:", linkErr);
    return jsonResponse({ error: "Failed to generate login link" }, 500);
  }

  return jsonResponse(
    {
      token_hash: linkData.properties.hashed_token,
      user_id: userId,
    },
    200
  );
});
