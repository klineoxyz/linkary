import React, { useState, useRef } from "react";
import { X, Download, Copy, Check, Share2 } from "lucide-react";
import { ReputationCard, CardTheme, CardType } from "./ReputationCard";
import { motion, AnimatePresence } from "motion/react";
import { copyToClipboard } from "../../utils/clipboard";

/**
 * Reputation Card Generator Modal
 * Allows users to generate, preview, download, and share their reputation card
 */

interface ReputationCardGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Card data
  avatar: string;
  name: string;
  handle: string;
  accountTier: string;
  reputationIndex: number;
  statusLine: string;
  reputationLevel?: number;
  reputationProgress?: number;
  metrics: any;
  type: CardType;
  
  // Share URL
  shareUrl: string;
}

export function ReputationCardGenerator({
  isOpen,
  onClose,
  avatar,
  name,
  handle,
  accountTier,
  reputationIndex,
  statusLine,
  reputationLevel,
  reputationProgress,
  metrics,
  type,
  shareUrl,
}: ReputationCardGeneratorProps) {
  const [theme, setTheme] = useState<CardTheme>("dark");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    
    // In production, you'd use html2canvas or similar
    // For now, we'll simulate download
    setTimeout(() => {
      // Mock download
      const link = document.createElement("a");
      link.download = `${handle}-reputation-card.png`;
      link.href = "#"; // Would be actual image data URL
      // link.click(); // Commented out to prevent actual download in demo
      setDownloading(false);
      
      // Show success message
      alert("Card downloaded! (Demo mode - actual download would trigger here)");
    }, 1000);
  };

  const handleShareTwitter = () => {
    const text = `Check out my Linkary Reputation Card!\n\n✅ ETHOS: ${metrics.ethos}\n✅ XScore: ${metrics.xscore}\n✅ Reputation Index: ${reputationIndex}\n\nVerified via @Linkary`;
    const url = shareUrl;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
  };

  const handleShareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-900 rounded-3xl border border-white/10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="p-8">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Generate Reputation Card</h2>
              <p className="text-neutral-400 text-sm">
                Share your Web3 reputation with a professional business card
              </p>
            </div>

            {/* Theme Selector */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-white mb-3 block">Card Theme</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTheme("dark")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    theme === "dark"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10"
                  }`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setTheme("neon")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    theme === "neon"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10"
                  }`}
                >
                  Neon
                </button>
                <button
                  onClick={() => setTheme("institutional")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    theme === "institutional"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10"
                  }`}
                >
                  Institutional
                </button>
              </div>
            </div>

            {/* Card Preview */}
            <div className="mb-6 flex justify-center">
              <div ref={cardRef} className="inline-block">
                <ReputationCard
                  avatar={avatar}
                  name={name}
                  handle={handle}
                  accountTier={accountTier}
                  reputationIndex={reputationIndex}
                  statusLine={statusLine}
                  reputationLevel={reputationLevel}
                  reputationProgress={reputationProgress}
                  metrics={metrics}
                  type={type}
                  theme={theme}
                  watermark={true}
                />
              </div>
            </div>

            {/* Share Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Download PNG */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:scale-100"
              >
                <Download className="w-4 h-4" />
                {downloading ? "Generating..." : "Download PNG"}
              </button>

              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-primary">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </button>

              {/* Share on Twitter */}
              <button
                onClick={handleShareTwitter}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent border border-border text-primary font-medium hover:bg-accent/80 transition-all"
              >
                <Share2 className="w-4 h-4" />
                Share on X
              </button>

              {/* Share on LinkedIn */}
              <button
                onClick={handleShareLinkedIn}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent border border-border text-foreground font-medium hover:bg-muted transition-all"
              >
                <Share2 className="w-4 h-4" />
                Share on LinkedIn
              </button>
            </div>

            {/* Share URL Display */}
            <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="text-xs text-neutral-400 mb-2 uppercase tracking-wide font-semibold">
                Share Link
              </div>
              <div className="text-sm text-white font-mono truncate">{shareUrl}</div>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 rounded-xl bg-accent border border-border">
              <div className="flex items-start gap-3">
                <Share2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-primary mb-1">Pro Tip: Social Sharing</h4>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    When you share your card on X or LinkedIn, it will auto-embed with a preview image. 
                    This increases engagement by 3-5x and helps build your Web3 reputation network faster.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Generate Card Button Component (add to profile pages)
export function GenerateCardButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all shadow-lg group"
    >
      <Share2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
      Generate Reputation Card
    </button>
  );
}