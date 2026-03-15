/**
 * Minimal HTTP server — no Next.js. Use to test if localhost works at all.
 * Run: node scripts/minimal-server.js
 * Then open http://localhost:3000 in your browser. You should see "Server OK".
 * If this works but Next.js doesn't, the issue is Next.js. If this doesn't work, the issue is firewall/network.
 */
const http = require("http");
const port = Number(process.env.PORT) || 3000;
const host = "127.0.0.1";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Server OK - if you see this, localhost works. The issue is Next.js.");
});

server.listen(port, host, () => {
  console.log(`Minimal server: http://${host}:${port}`);
  console.log("Open that URL in your browser. Press Ctrl+C to stop.");
});
