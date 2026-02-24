"use client";

import React, { useState, useEffect } from "react";
import { UserPlus, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  listAffiliationsForProfile,
  listAmbassadorsForProfile,
  getOrgById,
} from "@/lib/orgs";

export default function AffiliationAmbassadorSection() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [affiliations, setAffiliations] = useState<{ id: string; org_id: string; status: string; orgName?: string }[]>([]);
  const [ambassadors, setAmbassadors] = useState<{ id: string; org_id: string; status: string; orgName?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setProfileId(uid);
      if (!uid) {
        setLoading(false);
        return;
      }
      (async () => {
        const [aff, amb] = await Promise.all([
          listAffiliationsForProfile(uid),
          listAmbassadorsForProfile(uid),
        ]);
        const affWithNames = await Promise.all(
          aff.map(async (a) => {
            const o = await getOrgById(a.org_id);
            return { id: a.id, org_id: a.org_id, status: a.status, orgName: o?.name };
          })
        );
        const ambWithNames = await Promise.all(
          amb.map(async (a) => {
            const o = await getOrgById(a.org_id);
            return { id: a.id, org_id: a.org_id, status: a.status, orgName: o?.name };
          })
        );
        setAffiliations(affWithNames);
        setAmbassadors(ambWithNames);
        setLoading(false);
      })();
    });
  }, []);

  const handleAcceptAffiliation = async (id: string, orgId: string) => {
    if (!profileId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/orgs/${orgId}/affiliates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "active" }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && !json.error) setAffiliations((prev) => prev.map((a) => (a.id === id ? { ...a, status: "active" } : a)));
  };

  const handleAcceptAmbassador = async (id: string, orgId: string) => {
    if (!profileId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/orgs/${orgId}/ambassadors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "active" }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && !json.error) setAmbassadors((prev) => prev.map((a) => (a.id === id ? { ...a, status: "active" } : a)));
  };

  if (loading || (!affiliations.length && !ambassadors.length)) return null;

  return (
    <div className="rounded-xl border border-border bg-muted p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-primary" />
        Affiliation & Ambassadors
      </h3>

      {affiliations.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Affiliation (1 org max)</p>
          <ul className="space-y-2">
            {affiliations.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                <span className="flex items-center gap-2 text-gray-900">
                  <Building2 className="w-4 h-4 text-primary" />
                  {a.orgName ?? a.org_id}
                </span>
                {a.status === "invited" ? (
                  <button
                    onClick={() => handleAcceptAffiliation(a.id, a.org_id)}
                    className="px-3 py-1.5 rounded-lg bg-primary hover:opacity-90 text-white text-sm"
                  >
                    Accept
                  </button>
                ) : (
                  <span className="text-xs text-gray-500">{a.status}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ambassadors.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Ambassadors (up to 10 orgs)</p>
          <ul className="space-y-2">
            {ambassadors.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                <span className="flex items-center gap-2 text-gray-900">
                  <Building2 className="w-4 h-4 text-primary" />
                  {a.orgName ?? a.org_id}
                </span>
                {a.status === "invited" ? (
                  <button
                    onClick={() => handleAcceptAmbassador(a.id, a.org_id)}
                    className="px-3 py-1.5 rounded-lg bg-primary hover:opacity-90 text-white text-sm"
                  >
                    Accept
                  </button>
                ) : (
                  <span className="text-xs text-gray-500">{a.status}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
