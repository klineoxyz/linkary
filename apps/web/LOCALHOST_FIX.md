# Localhost / dev server not loading — final checklist

Do these **in order**. Stop at the first step that works.

---

## 1. Use the Network URL (same PC)

When you run `pnpm dev`, the terminal shows something like:

- **Network: http://10.5.0.2:3000** (your IP may differ)

**In your browser, open that Network URL** (e.g. `http://10.5.0.2:3000`), not localhost.

- If it loads → Use this URL for development. Localhost is broken on your machine; the app is fine.
- If it doesn’t load → Go to step 2.

To see your IP if needed: in PowerShell run `ipconfig` and look for "IPv4 Address" under your active adapter (e.g. 10.5.0.2, 192.168.1.x).

---

## 2. Make sure the server is on all interfaces

Run:

```powershell
cd C:\Users\Muaz\Desktop\Linkary\apps\web
pnpm run dev:network
```

Then try in the browser, in this order:

1. The **Network** URL shown in the terminal (e.g. `http://10.5.0.2:3000`)
2. **http://127.0.0.1:3000**
3. **http://localhost:3000**

If any of these load, use that URL from now on.

---

## 3. Test with the minimal server (no Next.js)

Stop the dev server (Ctrl+C), then:

```powershell
cd C:\Users\Muaz\Desktop\Linkary\apps\web
pnpm run dev:minimal-server
```

Open **http://127.0.0.1:3000** in the browser.

- **If you see "Server OK"** → Localhost works; the issue is Next.js. Use step 2 (Network URL or dev:network) for the real app, or try `pnpm run dev:webpack` and the Network URL.
- **If it never loads** → Something is blocking Node (firewall, antivirus, VPN). Do step 4.

---

## 4. Allow Node through the firewall

1. Press Win, type **Windows Defender Firewall**, open it.
2. Click **Allow an app or feature through Windows Defender Firewall**.
3. Click **Change settings**.
4. Find **Node.js** in the list and check **Private** and **Public**. If it’s not there, click **Allow another app**, browse to your Node.exe (e.g. `C:\Program Files\nodejs\node.exe`), add it, then check Private and Public.
5. OK, then restart the dev server and try the URLs again.

---

## 5. Try from another device (same Wi‑Fi)

1. On your PC: `pnpm run dev:network` (so it shows the Network URL).
2. On your **phone** (or another PC on the same Wi‑Fi), open that URL in the browser (e.g. `http://10.5.0.2:3000`).

- If it loads on the phone → Your PC’s browser or localhost stack is the problem; use the Network URL on the PC or develop from the phone for quick checks.
- If it doesn’t load on the phone → Firewall may be blocking incoming connections; add Node (or allow the app) for Private network.

---

## 6. Ruling out your environment

If **nothing** above works on this PC:

- Try the **same repo** on another PC or in **WSL** (`pnpm dev` there and open the URL it prints). If it works there, the issue is this Windows environment (firewall, antivirus, VPN, corporate policy).
- Temporarily disable **antivirus** or **security suites** and try again (only for a short test).
- Run PowerShell **as Administrator** and run the same commands; if it works only as admin, a security product is blocking Node when not elevated.

---

## Quick reference

| Command                 | Use when                          |
|-------------------------|-----------------------------------|
| `pnpm dev`              | Default (Turbopack).               |
| `pnpm run dev:network`  | Prefer Network URL / all interfaces. |
| `pnpm run dev:webpack`  | Turbopack has issues.              |
| `pnpm run dev:3001`     | Port 3000 is in use or blocked.   |
| `pnpm run dev:minimal-server` | Test if localhost works at all. |

**Most important:** try the **Network URL** (e.g. `http://10.5.0.2:3000`) in the browser first; it often works when localhost does not.
