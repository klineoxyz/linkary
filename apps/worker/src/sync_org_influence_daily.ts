/**
 * Daily cron: invoke web app sync-org-influence-daily endpoint.
 * Set CRON_INVOKE_URL to your web app base (e.g. https://your-app.railway.app) and CRON_SECRET.
 */
const CRON_INVOKE_URL = process.env.CRON_INVOKE_URL ?? process.env.WEB_APP_URL ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

async function main() {
  if (!CRON_INVOKE_URL.trim()) {
    console.error("[sync-org-influence-daily] CRON_INVOKE_URL or WEB_APP_URL not set. Set it to your web app base URL.");
    process.exit(1);
  }
  if (!CRON_SECRET) {
    console.error("[sync-org-influence-daily] CRON_SECRET not set.");
    process.exit(1);
  }

  const url = `${CRON_INVOKE_URL.replace(/\/$/, "")}/api/cron/sync-org-influence-daily`;
  const start = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-cron-secret": CRON_SECRET },
  });
  const durationMs = Date.now() - start;

  if (!res.ok) {
    const text = await res.text();
    console.error(`[sync-org-influence-daily] HTTP ${res.status} ${res.statusText} durationMs=${durationMs}`, text);
    process.exit(1);
  }

  const data = await res.json().catch(() => ({}));
  console.log(`[sync-org-influence-daily] ok processed=${data.processed ?? "?"} success=${data.success ?? "?"} errors=${data.errors ?? "?"} durationMs=${durationMs}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
