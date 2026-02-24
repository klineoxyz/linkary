/**
 * Lightweight assertions for isPrivateStorageUrl (run with: pnpm run check:storage-url).
 * No test framework required.
 */

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`isPrivateStorageUrl check failed: ${message}`);
}

export async function runIsPrivateStorageUrlChecks(): Promise<void> {
  const { isPrivateStorageUrl } = await import("./isPrivateStorageUrl");

  // With NEXT_PUBLIC_SUPABASE_URL set (or fallback): URLs under base + /storage/ are private
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") || "https://testproject.supabase.co";
  assert(
    isPrivateStorageUrl(`${base}/storage/v1/object/sign/bucket/key?token=xyz`),
    "storage/v1/object/sign URL should be private"
  );
  assert(
    isPrivateStorageUrl(`${base}/storage/v1/object/public/bucket/logo.png`),
    "storage/v1/object/public URL should be private"
  );
  assert(isPrivateStorageUrl(`${base}/storage/v1/object/foo`), "storage/v1/object URL should be private");
  assert(isPrivateStorageUrl(`${base}/storage/v1/bar`), "storage/v1 URL should be private");
  assert(isPrivateStorageUrl(`${base}/storage/bar`), "storage/ URL should be private");

  // Custom domain: generic fallback detects any host with /storage/ path
  assert(
    isPrivateStorageUrl("https://storage.mycompany.com/storage/v1/object/sign/b/k"),
    "custom domain storage URL should be private"
  );

  // Non-storage URLs must NOT be flagged
  assert(!isPrivateStorageUrl("https://linkary.xyz/foo"), "our domain should not be flagged");
  assert(!isPrivateStorageUrl("https://www.youtube.com/embed/abc"), "YouTube embed should not be flagged");
  assert(!isPrivateStorageUrl("https://player.vimeo.com/video/123"), "Vimeo embed should not be flagged");
  assert(!isPrivateStorageUrl("https://example.com/logo.png"), "generic HTTPS should not be flagged");
  assert(!isPrivateStorageUrl(""), "empty string should not be flagged");
  assert(!isPrivateStorageUrl(null), "null should not be flagged");
  assert(!isPrivateStorageUrl(undefined), "undefined should not be flagged");
}

runIsPrivateStorageUrlChecks()
  .then(() => console.log("isPrivateStorageUrl checks passed."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
