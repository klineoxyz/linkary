/**
 * Minimal page to verify the dev server serves HTML.
 * Open http://localhost:3000/test-server — no providers, no Supabase.
 */
export default function TestServerPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Dev server is running</h1>
      <p>If you see this, Next.js is responding. The main app (/) may be slow or stuck on compile.</p>
      <p>
        <a href="/">Go to home</a> · <a href="/api/health">API health</a>
      </p>
    </div>
  );
}
