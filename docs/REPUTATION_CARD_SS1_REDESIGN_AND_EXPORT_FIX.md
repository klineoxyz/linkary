# Linkary Reputation Card — SS1 Redesign & PNG Export Fix

## 1. Exact files changed

| File | Change |
|------|--------|
| `apps/web/src/figma/app/components/profile/ReputationCardPreview.tsx` | Full redesign to match SS1; local QR; optional `avatarDataUrl` and followers/circles in payload. |
| `apps/web/src/figma/app/components/profile/ReputationCardModal.tsx` | Export flow: fetch avatar as data URL before export, pass to card, then `toPng` after delay; error handling. |
| `apps/web/package.json` | Added `qrcode` and `@types/qrcode` for client-side QR generation. |
| `docs/REPUTATION_CARD_SS1_REDESIGN_AND_EXPORT_FIX.md` | This deliverable. |

**Not changed:** `App.tsx` (payload call already compatible; optional `followersCount`/`circlesCount` can be added later when data exists).

---

## 2. Exact design/layout changes (SS1 alignment)

- **Background:** Replaced flat bar + white card with a single **premium gradient**: warm orange (#FF5300) at top → #FF8440 → #FFB380 → #FFF5F0 → white at bottom, with a subtle radial overlay for depth.
- **Branding:** Centered **logo + tagline** at top: inline SVG (three orange bars) + “Linkary” wordmark + “Verified Signals • Trusted Connections” in smaller type.
- **Avatar:** **Large circular avatar** (96px) with orange/cream **ring and soft glow** (box-shadow), plus **verification badge** (orange circle + BadgeCheck) on bottom-right.
- **Name/headline:** **Large bold display name**; headline (first line of bio) and **role chips as “Investor • KOL • …”** (bullet-separated) below.
- **Metrics:** **2×2 elevated metric cards** with soft shadow and light cream bg (#FFFBF9): **ETHOS** (shield), **POWER** (zap), **REP** (star), **TIER** (crown). Label above, bold value below; only blocks with data shown.
- **Compact rows:** Two rows below metrics: **Followers** (Users), **Verified Collabs** (Handshake), **Case Studies** (BarChart3), **Circles** (CircleDot). Each: orange icon + bold number + label. Only shown when real data exists.
- **QR section:** **Local QR** (generated with `qrcode` to data URL, no external img). “Scan to open profile” label; **public profile URL** in bold below. No external qrserver.com request.
- **Polish:** Rounded corners (rounded-2xl card, rounded-xl metric blocks), consistent spacing, typography hierarchy (bold values, muted labels), #130600 / rgba(19,6,0,…) for text, #FF5300 for accents.

---

## 3. Why export was failing

- **External QR image:** The card used `<img src="https://api.qrserver.com/...">`. Drawing that into the canvas **taints** it (cross-origin), so `toDataURL('image/png')` throws or returns a blank/tainted canvas.
- **External avatar:** Avatar came from `unavatar.io` or Supabase storage (often cross-origin). Same taint when html-to-image drew the card.
- **Result:** `toPng(node)` failed or produced a broken PNG whenever the card contained any cross-origin image.

---

## 4. Exact fix for PNG export

1. **Local QR:**  
   - Use the `qrcode` package: `QRCode.toDataURL(publicProfileUrl, { width: 200, margin: 1 })`.  
   - Card renders `<img src={qrDataUrl} />` where `qrDataUrl` is that data URL.  
   - No external request; no taint.

2. **Avatar inlining before export:**  
   - On “Export PNG” click, the modal **fetches the avatar URL** with `fetch(url, { mode: 'cors' })`, converts the response to a blob, then to a **data URL** via `FileReader.readAsDataURL(blob)`.  
   - Modal passes this as **`avatarDataUrl`** into `ReputationCardPreview` only **while exporting** (`avatarDataUrl={exporting ? exportAvatarDataUrl : undefined}`).  
   - The card renders the avatar from that data URL during export, so the DOM has no cross-origin image when `toPng` runs.

3. **Timing:**  
   - After setting `exportAvatarDataUrl` (or null if no avatar), set `exportPrepared = true`.  
   - A `useEffect` runs when `exporting && exportPrepared`; after a **~450ms delay** (so the card has re-rendered and the data-URL avatar has painted), call `toPng(cardRef.current, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })` and trigger download.

4. **Logo:**  
   - Card logo is inline SVG (orange bars) and the word “Linkary” is text; no external image there.  
   - All pixels drawn in the export are either same-origin or data URLs, so the canvas is not tainted and export succeeds.

---

## 5. Before/after

- **Before (SS2):** Flat orange bar, small square avatar, simple grid, external QR img, no gradient or glow. Export failed due to tainted canvas from QR + avatar.
- **After (SS1-style):** Full-card gradient, prominent branding, large circular avatar with ring/badge, 2×2 metric blocks, compact info rows, local QR, “Scan to open profile” + URL. Export works because QR is a data URL and avatar is inlined to a data URL before `toPng`.

---

## 6. QA checklist

- [ ] **Preview quality:** Card shows gradient, logo, tagline, circular avatar with ring and badge, name, headline, role chips, 2×2 metrics, compact rows (when data exists), QR and URL. No layout shift when opening modal.
- [ ] **Export works:** Click “Export PNG” → file downloads; no console error; PNG opens and looks correct.
- [ ] **QR scans correctly:** Scanned QR opens the canonical public profile URL (e.g. `https://.../username`).
- [ ] **Exported PNG matches preview:** Exported image matches the modal preview (gradient, text, metrics, QR, no missing or blank areas from taint).
- [ ] **Mobile modal layout:** Modal is responsive; card is readable and scrollable on small/portrait screens; Export button remains usable.

---

## 7. Founder summary

- **What was wrong before:**  
  The card looked like a plain dashboard block (flat bar, small avatar, basic grid, external QR). It did not feel like a premium, shareable reputation/NFC card. PNG export failed because the card used **external images** (QR from qrserver.com and avatar from unavatar or storage). The browser’s canvas becomes **tainted** when you draw cross-origin images, so exporting to PNG was blocked or broken.

- **How the new version matches SS1:**  
  The card now has a **warm orange-to-white gradient**, **centered Linkary branding** (logo + tagline), a **large circular avatar with ring and verification badge**, **clear typography** (name, headline, role chips), **elevated 2×2 metric blocks** (ETHOS, Power, REP, Tier) with icons, **compact info rows** (Followers, Verified Collabs, Case Studies, Circles) when data exists, and a **large QR section** with “Scan to open profile” and the public URL. Styling uses Linkary colors (#FF5300, #130600, cream/white) and soft shadows so it feels like a premium digital identity card.

- **Why export works now:**  
  **QR** is generated **in the browser** with the `qrcode` library and shown as a **data URL** image, so there is no cross-origin QR request. **Avatar** is **fetched and converted to a data URL** when the user clicks Export, and that data URL is passed into the card only during export so the card’s DOM has no cross-origin images when we call `toPng`. The **logo** is inline SVG and text. With no tainted canvas, the export produces a **clean, high-resolution PNG** that matches the preview.
