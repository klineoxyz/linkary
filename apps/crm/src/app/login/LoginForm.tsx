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
        className="crm-input placeholder:text-[var(--crm-muted)]"
        disabled={loading}
        autoComplete="email"
      />
      <button type="submit" disabled={loading} className="crm-btn-primary w-full py-2.5">
        {loading ? "Sending…" : "Send magic link"}
      </button>
      {message && (
        <p
          role={message.type === "err" ? "alert" : "status"}
          className={`text-sm rounded-[var(--crm-radius)] px-3 py-2 ${
            message.type === "err"
              ? "bg-[var(--crm-banner-muted)] text-[var(--crm-foreground)] border border-[var(--crm-border)]"
              : "crm-surface-muted text-[var(--crm-foreground)]"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
