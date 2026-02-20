"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

const BASE_CHAIN_ID = 8453;
const BASE_EXPLORER = "https://basescan.org";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

function normalizeHandle(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, "");
}

function looksLikeAddress(input: string): boolean {
  const t = input.trim();
  if (t.startsWith("0x") && t.length === 42) return true;
  if (t.length >= 32 && t.length <= 44 && !t.startsWith("0x")) return true;
  return false;
}

/** ETH amount to wei (bigint). */
function parseEther(amount: string): bigint {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return BigInt(0);
  const [whole, frac = ""] = amount.trim().split(".");
  const padded = whole + frac.slice(0, 18).padEnd(18, "0");
  return BigInt(padded);
}

/** USDC amount to 6-decimal units (bigint). */
function parseUsdc(amount: string): bigint {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return BigInt(0);
  const [whole, frac = ""] = amount.trim().split(".");
  const padded = whole + frac.slice(0, 6).padEnd(6, "0");
  return BigInt(padded);
}

/** Encode ERC20 transfer(to, amount) calldata. */
function encodeTransfer(to: string, amount: bigint): `0x${string}` {
  const toHex = to.slice(2).toLowerCase().padStart(64, "0");
  const amountHex = amount.toString(16).padStart(64, "0");
  return `0xa9059cbb${toHex}${amountHex}` as `0x${string}`;
}

/** Turn API/network errors into a short, user-friendly message. */
function friendlySendError(e: unknown): string {
  let msg = "Transaction failed";
  if (e instanceof Error) msg = e.message;
  else if (typeof e === "string") msg = e;
  else if (e && typeof e === "object" && "errorMessage" in e && typeof (e as { errorMessage: string }).errorMessage === "string")
    msg = (e as { errorMessage: string }).errorMessage;
  else if (e && typeof e === "object" && "message" in e && typeof (e as { message: string }).message === "string")
    msg = (e as { message: string }).message;
  else if (e != null) msg = String(e);
  const lower = msg.toLowerCase();
  if (lower.includes("insufficient balance")) {
    return "Your wallet doesn’t have enough balance. For ETH you need enough ETH for the amount plus gas. For USDC you need enough USDC. Add funds via Deposit USDC or from another wallet, then try again.";
  }
  return msg || "Transaction failed";
}

interface SendTxPanelProps {
  address: string | null;
  getToken: () => Promise<string | null>;
}

function useCdpSendEvm() {
  try {
    const { useSendEvmTransaction, useEvmAddress } = require("@coinbase/cdp-hooks");
    const { sendEvmTransaction } = useSendEvmTransaction();
    const { evmAddress } = useEvmAddress();
    return { sendEvmTransaction, evmAddress: evmAddress ?? null };
  } catch {
    return { sendEvmTransaction: null, evmAddress: null };
  }
}

export default function SendTxPanel({ address, getToken }: SendTxPanelProps) {
  const { sendEvmTransaction, evmAddress } = useCdpSendEvm();
  const [toInput, setToInput] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [currentUserHandle, setCurrentUserHandle] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"ETH" | "USDC">("ETH");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toAddress = resolvedAddress ?? (looksLikeAddress(toInput) ? toInput.trim() : null);
  const isHandle = toInput.trim() && !looksLikeAddress(toInput.trim());
  const rawInput = normalizeHandle(toInput);

  // Load current user's handle so we can show own address instantly
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, twitter_username")
        .eq("id", uid)
        .maybeSingle();
      const p = profile as { username?: string | null; twitter_username?: string | null } | null;
      const handle = p?.username ?? p?.twitter_username;
      setCurrentUserHandle(handle ? normalizeHandle(handle) : null);
    })();
  }, []);

  // When user types their own handle, show resolved address immediately (no API call)
  useEffect(() => {
    if (!currentUserHandle || !address) return;
    if (rawInput && rawInput === currentUserHandle) {
      setResolvedAddress(address);
      setError(null);
      return;
    }
    if (!rawInput || resolvedAddress === address) setResolvedAddress(null);
  }, [rawInput, currentUserHandle, address, resolvedAddress]);

  // Auto-resolve other handles after user stops typing (debounce 500ms)
  useEffect(() => {
    if (!isHandle || rawInput === currentUserHandle) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      resolveHandle();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [toInput]);

  const resolveHandle = async (): Promise<string | null> => {
    const raw = toInput.trim().toLowerCase().replace(/^@/, "");
    if (!raw) {
      setResolvedAddress(null);
      return null;
    }
    if (looksLikeAddress(raw)) {
      setResolvedAddress(raw);
      return raw;
    }
    setResolving(true);
    setError(null);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/wallet/resolve?username=${encodeURIComponent(raw)}`);
      const j = await res.json();
      if (res.ok && j.address) {
        setResolvedAddress(j.address);
        return j.address;
      }
      setResolvedAddress(null);
      setError(
        "This handle is not registered on Linkary. Double-check the username or send to their wallet address (0x...) instead."
      );
      return null;
    } catch {
      setResolvedAddress(null);
      setError(
        "Could not look up this handle. Double-check the username or send to their wallet address (0x...) instead."
      );
      return null;
    } finally {
      setResolving(false);
    }
  };

  const handleSend = async () => {
    setError(null);
    setTxHash(null);
    setExplorerUrl(null);
    let to: string | null = looksLikeAddress(toInput) ? toInput.trim() : resolvedAddress;
    if (!to && toInput.trim()) {
      to = await resolveHandle();
      if (!to) return;
    }
    if (!to) {
      setError("Enter a Linkary handle (@username) or a wallet address");
      return;
    }
    const valueStr = amount.trim();
    if (!valueStr || Number.isNaN(Number(valueStr)) || Number(valueStr) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!address || !evmAddress) {
      setError("Wallet not connected. Make sure you are signed in with your CDP wallet.");
      return;
    }
    if (!sendEvmTransaction) {
      setError("Send is not available. Please refresh and try again.");
      return;
    }

    setSending(true);
    try {
      if (asset === "ETH") {
        const valueWei = parseEther(valueStr);
        if (valueWei === BigInt(0)) {
          setError("Enter a valid amount");
          setSending(false);
          return;
        }
        const result = await sendEvmTransaction({
          evmAccount: evmAddress,
          network: "base",
          transaction: {
            to: to as `0x${string}`,
            value: valueWei,
            gas: BigInt(21000),
            chainId: BASE_CHAIN_ID,
            type: "eip1559",
          },
        });
        const hash = (result as { transactionHash?: string })?.transactionHash;
        if (hash) {
          setTxHash(hash);
          setExplorerUrl(`${BASE_EXPLORER}/tx/${hash}`);
        } else {
          setError("Transaction submitted but no hash returned. Check your wallet.");
        }
      } else {
        const valueUnits = parseUsdc(valueStr);
        if (valueUnits === BigInt(0)) {
          setError("Enter a valid amount");
          setSending(false);
          return;
        }
        const data = encodeTransfer(to, valueUnits);
        const result = await sendEvmTransaction({
          evmAccount: evmAddress,
          network: "base",
          transaction: {
            to: USDC_BASE,
            value: BigInt(0),
            data,
            gas: BigInt(100000),
            chainId: BASE_CHAIN_ID,
            type: "eip1559",
          },
        });
        const hash = (result as { transactionHash?: string })?.transactionHash;
        if (hash) {
          setTxHash(hash);
          setExplorerUrl(`${BASE_EXPLORER}/tx/${hash}`);
        } else {
          setError("Transaction submitted but no hash returned. Check your wallet.");
        }
      }
    } catch (e) {
      setError(friendlySendError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Send test transaction</h3>
      <p className="text-sm text-muted-foreground">
        Send ETH or USDC on Base to a Linkary handle or any wallet address. You will sign the transaction with your CDP wallet.
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            To (Linkary handle or wallet address)
          </label>
          <input
            type="text"
            placeholder="@username or 0x..."
            value={toInput}
            onChange={(e) => {
              setToInput(e.target.value);
              setResolvedAddress(null);
              setError(null);
            }}
            onBlur={() => {
              if (isHandle && toInput.trim()) resolveHandle();
            }}
            className="h-10 w-full rounded-lg border border-border bg-input-background px-3 text-sm"
          />
          {resolving && <p className="text-xs text-muted-foreground mt-1">Resolving handle…</p>}
          {resolvedAddress && isHandle && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">Resolved to: {resolvedAddress.slice(0, 10)}…{resolvedAddress.slice(-8)}</p>
          )}
          {isHandle && !resolvedAddress && !resolving && !error && (
            <p className="text-xs text-muted-foreground mt-1">Not on Linkary? Enter their wallet address (0x...) to send.</p>
          )}
          {error && isHandle && (
            <div className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
              {error}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Amount</label>
          <input
            type="text"
            placeholder="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-input-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Asset</label>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value as "ETH" | "USDC")}
            className="h-10 w-full rounded-lg border border-border bg-input-background px-3 text-sm"
          >
            <option value="ETH">ETH</option>
            <option value="USDC">USDC</option>
          </select>
        </div>
        {error && !isHandle && <p className="text-sm text-destructive">{error}</p>}
        {txHash && explorerUrl && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-mono text-xs break-all">{txHash}</p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on explorer
            </a>
          </div>
        )}
        <button
          type="button"
          disabled={sending || !address || (!toAddress && !toInput.trim())}
          onClick={handleSend}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg font-medium h-10 px-4 text-sm",
            "bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-50"
          )}
        >
          <Send className="h-4 w-4 stroke-[1.75]" />
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
