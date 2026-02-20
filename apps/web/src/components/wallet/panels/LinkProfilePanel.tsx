"use client";

import React from "react";
import { Mail, Phone, Link2 } from "lucide-react";

export default function LinkProfilePanel() {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Link a profile</h3>
      <p className="text-sm text-muted-foreground">
        Link additional sign-in methods (email, phone, social) to your wallet for recovery and verification. This is not yet available in the current configuration.
      </p>
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Available when supported</p>
        <div className="flex flex-wrap gap-2">
          {[
            { icon: Mail, label: "Email" },
            { icon: Phone, label: "Phone" },
            { icon: Link2, label: "Google, Apple, X" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
