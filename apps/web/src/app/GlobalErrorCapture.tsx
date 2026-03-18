"use client";

import { useEffect } from "react";

function path(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname || "/";
}

function messageFrom(reason: unknown): string {
  if (reason instanceof Error) return reason.message || "";
  if (typeof reason === "string") return reason;
  if (reason && typeof reason === "object" && "message" in reason) return String((reason as { message: unknown }).message);
  return String(reason ?? "");
}

function stackFrom(reason: unknown): string {
  if (reason instanceof Error && reason.stack) return reason.stack;
  return "";
}

/**
 * Registers global error and unhandledrejection listeners so we can see the real
 * root cause in Vercel logs (and optionally Sentry later). Logs a single-line
 * structured message: [CLIENT_ERROR] type=... path=... message=... stack=...
 */
export default function GlobalErrorCapture() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const p = path();
      const msg = event.message || messageFrom(event.error);
      const stack = event.error instanceof Error ? (event.error.stack || "") : "";
      const line = `[CLIENT_ERROR] type=error path=${p} message=${msg.replace(/\s+/g, " ").slice(0, 200)} stack=${stack.slice(0, 300).replace(/\s+/g, " ")}`;
      if (typeof console !== "undefined") console.error(line);
      try {
        const w = window as unknown as { __linkary_reportError?: (s: string) => void };
        if (typeof w.__linkary_reportError === "function") w.__linkary_reportError(line);
      } catch {
        /* ignore */
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const p = path();
      const msg = messageFrom(event.reason);
      const stack = stackFrom(event.reason);
      const line = `[CLIENT_ERROR] type=unhandledrejection path=${p} message=${msg.replace(/\s+/g, " ").slice(0, 200)} stack=${stack.slice(0, 300).replace(/\s+/g, " ")}`;
      if (typeof console !== "undefined") console.error(line);
      try {
        const w = window as unknown as { __linkary_reportError?: (s: string) => void };
        if (typeof w.__linkary_reportError === "function") w.__linkary_reportError(line);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
