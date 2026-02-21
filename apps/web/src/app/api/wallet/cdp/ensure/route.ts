/**
 * GET/POST /api/wallet/cdp/ensure
 * Post-login wallet provisioning: requires existing Supabase session (X login).
 * GET: returns current wallet or { needsCreate: true }. POST: persist client-provided address (client creates via CDP SDK first).
 * Wallet stored in profiles.cdp_wallet_address only; never as email. Display as "Wallet (CDP) 0x...".
 */
export { GET, POST } from "../get-or-create/route";
