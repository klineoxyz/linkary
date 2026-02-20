"use client";

import React from "react";
import {
  Link2,
  Shield,
  Send,
  Key,
  Wallet,
  ExternalLink,
} from "lucide-react";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

export type PanelId =
  | "link-profile"
  | "mfa"
  | "send-tx"
  | "export-keys"
  | "deposit-usdc"
  | "external-wallets";

const ITEMS: { id: PanelId; label: string; icon: React.ElementType }[] = [
  { id: "link-profile", label: "Link a profile", icon: Link2 },
  { id: "mfa", label: "Multi-factor authentication", icon: Shield },
  { id: "send-tx", label: "Send test transaction", icon: Send },
  { id: "export-keys", label: "Export keys", icon: Key },
  { id: "deposit-usdc", label: "Deposit USDC", icon: Wallet },
  { id: "external-wallets", label: "External wallets", icon: ExternalLink },
];

interface WalletSidebarProps {
  panel: PanelId;
  setPanel: (p: PanelId) => void;
}

export default function WalletSidebar({ panel, setPanel }: WalletSidebarProps) {
  return (
    <nav className="space-y-1">
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setPanel(id)}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
            panel === id
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4 stroke-[1.75] shrink-0" />
          {label}
        </button>
      ))}
    </nav>
  );
}
