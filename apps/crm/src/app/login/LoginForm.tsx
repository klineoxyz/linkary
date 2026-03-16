"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const baseUrl = typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin)
      : (process.env.NEXT_PUBLIC_APP_URL || "");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${baseUrl.replace(/\/$/, "")}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "err", text: error.message });
      return;
    }
    setMessage({ type: "ok", text: "Check your email for the sign-in link." });
  }

  return (
    <form onSubmit={handleMagicLink} className="space-y-4">
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm text-[var(--crm-primary)] placeholder:text-[var(--crm-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--crm-primary)]"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--crm-primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send magic link"}
      </button>
      {message && (
        <p className={`text-sm ${message.type === "err" ? "text-red-600" : "text-green-600"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
