# Dev server not opening (localhost:3000)

If **http://localhost:3000** (or the Network URL) never loads—browser stays blank or "waiting"—try these in order.

## 1. Use Webpack instead of Turbopack (try this first)

Next.js 16 uses Turbopack by default. On some machines the first request gets stuck on "Compiling / ..." and the page never loads. Use the Webpack dev server instead:

```powershell
cd C:\Users\Muaz\Desktop\Linkary\apps\web
pnpm run dev:webpack
```

Wait until you see **"Ready"** (first compile can take 30–60 seconds). Then open **http://localhost:3000** in your browser.

## 2. Use port 3001

In case something is blocking port 3000:

```powershell
cd C:\Users\Muaz\Desktop\Linkary\apps\web
pnpm run dev:3001
```

Then open **http://localhost:3001** in your browser.

## 2. Check if port 3000 is reachable

In a **new** PowerShell window (with no dev server running):

```powershell
cd C:\Users\Muaz\Desktop\Linkary\apps\web
node -e "require('http').createServer((q,r)=>{r.end('OK');}).listen(3000, ()=>console.log('Listening on http://localhost:3000'));"
```

- Open **http://localhost:3000** in the browser. If you see **OK**, the port works and the issue is likely Next.js (compilation or app code).
- If the browser can’t connect, **Windows Firewall or antivirus** may be blocking Node. Add an allow rule for Node.js, or try from an **Administrator** terminal.

Press Ctrl+C to stop the test server.

## 4. Allow Node through Windows Firewall

1. Windows Security → Firewall & network protection → Allow an app through firewall.
2. Find **Node.js** (or add it via “Allow another app”) and enable **Private** (and **Public** if you need it).
3. Restart the dev server and try **http://localhost:3000** again.

## 4. Disable VPN / try another browser

- Turn off any VPN; some break localhost.
- Try a different browser or a private/incognito window.

## 6. Run from repo root

```powershell
cd C:\Users\Muaz\Desktop\Linkary
pnpm dev
```

Then open **http://localhost:3000** (or **http://127.0.0.1:3000**).

## Summary of scripts

- **next.config.ts**: `turbopack.root` set so Turbopack uses the monorepo root (fixes “inferred workspace root” and can help compilation).
- **pnpm run dev:webpack** – use Webpack instead of Turbopack (use if the page never loads).
- **pnpm run dev:3001** – run on port 3001 if 3000 is blocked.
