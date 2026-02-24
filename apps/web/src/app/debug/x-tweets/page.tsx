"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Row = {
  tweeted_at: string | null;
  tweet_id: string;
  text_preview: string;
  like_count: number;
  reply_count: number;
  repost_count: number;
  engagement: number;
};

function DebugXTweetsContent() {
  const searchParams = useSearchParams();
  const day = searchParams.get("day") ?? "";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setLoading(false);
      setError("Add query param day=YYYY-MM-DD");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/debug/x-tweets?day=${encodeURIComponent(day)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cancelled) return;
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) setUnauthorized(true);
        else setError(json.message ?? "Request failed");
        setLoading(false);
        return;
      }
      setRows(json.rows ?? []);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [day]);

  if (unauthorized) {
    return (
      <div className="min-h-screen p-6 bg-[#F7F8FB]">
        <p className="text-gray-700">Sign in to view this page.</p>
        <Link href="/login" className="text-primary hover:underline mt-2 inline-block">Go to login</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-[#F7F8FB] text-gray-900">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-bold mb-2">X Tweets by Day (Debug)</h1>
        <p className="text-sm text-gray-600 mb-4">
          Day: <strong>{day || "—"}</strong> {day && "(from query param)"}
        </p>
        {error && <p className="text-destructive text-sm mb-4">{error}</p>}
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left p-2 font-semibold">tweeted_at</th>
                  <th className="text-left p-2 font-semibold">tweet_id</th>
                  <th className="text-left p-2 font-semibold">text (120)</th>
                  <th className="text-right p-2 font-semibold">likes</th>
                  <th className="text-right p-2 font-semibold">replies</th>
                  <th className="text-right p-2 font-semibold">reposts</th>
                  <th className="text-right p-2 font-semibold">engagement</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-gray-500">No tweets for this day.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.tweet_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-2 font-mono text-xs">{r.tweeted_at ?? "—"}</td>
                      <td className="p-2 font-mono text-xs">{r.tweet_id}</td>
                      <td className="p-2 max-w-xs truncate" title={r.text_preview}>{r.text_preview || "—"}</td>
                      <td className="p-2 text-right">{r.like_count}</td>
                      <td className="p-2 text-right">{r.reply_count}</td>
                      <td className="p-2 text-right">{r.repost_count}</td>
                      <td className="p-2 text-right font-medium">{r.engagement}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <Link href="/analytics" className="inline-block mt-4 text-sm text-primary hover:underline">Back to Analytics</Link>
      </div>
    </div>
  );
}

export default function DebugXTweetsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-6 bg-[#F7F8FB] text-gray-600">Loading…</div>}>
      <DebugXTweetsContent />
    </Suspense>
  );
}
