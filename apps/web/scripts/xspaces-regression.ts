/**
 * XSpaces regression: date tests + governance grep. Run from repo root:
 *   pnpm --filter web run test:xspaces
 * Or from apps/web:
 *   pnpm run test:xspaces
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const FORBIDDEN_PREFIXES = [
  "zinc-", "neutral-", "bg-black", "text-white", "amber-", "red-", "green-", "blue-", "slate-", "gray-", "bg-white",
];
function tokenHasForbidden(token: string): boolean {
  return FORBIDDEN_PREFIXES.some((p) => token === p || token.startsWith(p + "-") || token.startsWith(p + "/"));
}
const ROOT = join(process.cwd(), "src", "figma", "app", "components");
const XSPACES_PAGE = join(ROOT, "XSpacesPage.tsx");
const XSPACES_DIR = join(ROOT, "xspaces");

function readFiles(dir: string, ext: string): { path: string; content: string }[] {
  const out: { path: string; content: string }[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) {
      out.push(...readFiles(full, ext));
    } else if (name.name.endsWith(ext)) {
      out.push({ path: full, content: readFileSync(full, "utf8") });
    }
  }
  return out;
}

function governanceCheck(): boolean {
  let failed = false;
  const files = [
    { path: XSPACES_PAGE, content: readFileSync(XSPACES_PAGE, "utf8") },
    ...readFiles(XSPACES_DIR, ".tsx"),
    ...readFiles(XSPACES_DIR, ".ts"),
  ].filter((f) => f.content.length > 0);

  for (const { path, content } of files) {
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      const classNameMatch = line.match(/className=["'`]([^"'`]+)["'`]/);
      if (!classNameMatch) return;
      const tokens = classNameMatch[1].split(/\s+/);
      for (const token of tokens) {
        if (tokenHasForbidden(token)) {
          console.error(`Governance: ${path}:${i + 1}: forbidden class token: ${token}`);
          failed = true;
        }
      }
    });
  }
  return !failed;
}

async function main() {
  console.log("Running XSpaces date/utils tests...");
  await import("../src/figma/app/components/xspaces/utils.test.ts").catch((e) => {
    console.error("Date tests failed:", e);
    process.exit(1);
  });

  console.log("Running XSpaces governance grep...");
  if (!governanceCheck()) {
    process.exit(1);
  }
  console.log("All XSpaces regression checks passed.");
}

main();
