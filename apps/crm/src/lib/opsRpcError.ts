/** Map Postgres exceptions from ops_atomic_* RPCs (message contains OPS_* token). */
export function mapOpsRpcError(e: { message?: string | null }): { code: string; status: number; message: string } {
  const m = (e.message ?? "").toString();
  if (m.includes("OPS_NOT_FOUND")) return { code: "NOT_FOUND", status: 404, message: m };
  if (m.includes("OPS_ALREADY_REVOKED")) return { code: "ALREADY_REVOKED", status: 409, message: m };
  if (m.includes("OPS_ROW_NOT_FOUND")) return { code: "ROW_NOT_FOUND", status: 404, message: m };
  if (m.includes("OPS_REASON_REQUIRED")) return { code: "REASON_REQUIRED", status: 400, message: m };
  if (m.includes("OPS_EXPIRES_INVALID")) return { code: "EXPIRES_REQUIRED", status: 400, message: m };
  if (m.includes("OPS_SCOPES_REQUIRED")) return { code: "SCOPES_REQUIRED", status: 400, message: m };
  if (m.includes("OPS_INVALID_SUBJECT")) return { code: "INVALID_SUBJECT", status: 400, message: m };
  if (m.includes("OPS_PAYLOAD_INVALID")) return { code: "PAYLOAD_INVALID", status: 400, message: m };
  if (m.includes("OPS_PLAN_KEY_REQUIRED")) return { code: "INVALID_PLAN_KEY", status: 400, message: m };
  if (m.includes("OPS_INVALID_OWNER")) return { code: "INVALID_OWNER", status: 400, message: m };
  if (m.includes("OPS_METRIC_REQUIRED")) return { code: "INVALID_METRIC", status: 400, message: m };
  if (m.includes("OPS_INVALID_KIND")) return { code: "INVALID_KIND", status: 400, message: m };
  return { code: "RPC_FAILED", status: 500, message: m || "RPC failed" };
}
