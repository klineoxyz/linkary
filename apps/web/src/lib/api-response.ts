import { NextResponse } from "next/server";

export type ResponseInit = { status?: number; headers?: HeadersInit };

/**
 * Success response: { ok: true, ...data }
 */
export function ok(data?: Record<string, unknown>, init?: ResponseInit): NextResponse {
  const status = init?.status ?? 200;
  const body = data ? { ok: true as const, ...data } : { ok: true };
  return NextResponse.json(body, { ...init, status });
}

/**
 * Error response: { ok: false, code, message, ...extra }
 * For status 429 (RATE_LIMITED), adds Retry-After header when extra.resetAt (ISO timestamp) is present.
 */
export function fail(
  code: string,
  message: string,
  status: number = 400,
  extra?: Record<string, unknown>
): NextResponse {
  const body = { ok: false as const, code, message, ...extra };
  const init: ResponseInit = { status };
  if (status === 429 && extra?.resetAt && typeof extra.resetAt === "string") {
    const resetAt = new Date(extra.resetAt as string).getTime();
    const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    init.headers = { "Retry-After": String(seconds) };
  }
  return NextResponse.json(body, init);
}

/**
 * Optional: wrap an async handler with try/catch; on throw returns fail("INTERNAL", message, 500).
 */
export function wrap<T extends (...args: unknown[]) => Promise<NextResponse>>(
  handler: T,
  internalMessage: string = "An unexpected error occurred"
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : internalMessage;
      return fail("INTERNAL", message, 500);
    }
  }) as T;
}
