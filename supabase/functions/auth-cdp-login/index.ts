// Linkary: CDP wallet login bridge — verify signature, find/create user, return magic link token.
// Client calls supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) to get session.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/ethers@6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LINKARY_LOGIN_PREFIX = "Linkary login: ";

function normalizeAddress(a: string): string {
  return a.startsWith("0x") ? a.toLowerCase() : "0x" + a.toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { address?: string; message?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { address: rawAddress, message, signature } = body;
  if (!rawAddress || !message || !signature) {
    return new Response(
      JSON.stringify({ error: "Missing address, message, or signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!message.startsWith(LINKARY_LOGIN_PREFIX)) {
    return new Response(
      JSON.stringify({ error: "Invalid message format" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let recovered: string;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const address = normalizeAddress(rawAddress);
  const recoveredNorm = normalizeAddress(recovered);
  if (recoveredNorm !== address) {
    return new Response(
      JSON.stringify({ error: "Signature does not match address" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
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
      return new Response(
        JSON.stringify({ error: "Failed to create user: " + (createErr?.message ?? "unknown") }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    userId = newUser.user.id;
    const { error: insertErr } = await supabase.from("wallet_identities").insert({
      user_id: userId,
      address,
    });
    if (insertErr) {
      console.error("wallet_identities insert error:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to link wallet" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: `${address}@wallet.linkary.xyz`,
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("generateLink error:", linkErr);
    return new Response(
      JSON.stringify({ error: "Failed to generate login link" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      token_hash: linkData.properties.hashed_token,
      user_id: userId,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
