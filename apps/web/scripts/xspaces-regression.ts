/**
 * XSpaces regression: date tests + governance grep. Run from repo root:
 *   pnpm --filter web run test:xspaces
 * Or from apps/web:
 *   pnpm run test:xspaces
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const FORBIDDEN_PREFIXES = [
  "zinc-", "neutral-", "bg-black", "text-white", "bg-white", "border-white", "ring-white",
  "amber-", "red-", "green-", "blue-", "slate-", "gray-",
];
/** Known-safe tokens that may contain forbidden substrings (e.g. translate-x contains "slate") */
const ALLOWLIST = ["-translate-x-1/2", "-translate-y-1/2", "translate-x-", "translate-y-", "-translate-x", "-translate-y"];
function tokenHasForbidden(token: string): boolean {
  if (ALLOWLIST.some((a) => token === a || token.startsWith(a))) return false;
  return FORBIDDEN_PREFIXES.some((p) => token === p || token.startsWith(p + "-") || token.startsWith(p + "/"));
}
const ROOT = join(process.cwd(), "src", "figma", "app", "components");
const XSPACES_PAGE = join(ROOT, "XSpacesPage.tsx");
const XSPACES_DIR = join(ROOT, "xspaces");

function isCommentOnlyOrCommentedLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t === "" || t.startsWith("*") || t.startsWith("/*");
}

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
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isCommentOnlyOrCommentedLine(line)) continue;
      const classNameMatch = line.match(/className=["'`]([^"'`]+)["'`]/);
      if (!classNameMatch) continue;
      const tokens = classNameMatch[1].split(/\s+/);
      for (const token of tokens) {
        if (tokenHasForbidden(token)) {
          const snippet = line.trim().slice(0, 80) + (line.trim().length > 80 ? "..." : "");
          console.error(`Governance FAIL: ${path}:${i + 1}`);
          console.error(`  forbidden token: ${token}`);
          console.error(`  snippet: ${snippet}`);
          failed = true;
        }
      }
    }
  }
  return !failed;
}

function main() {
  console.log("Running XSpaces date/utils tests...");
  const cwd = process.cwd();
  const testPath = join(cwd, "src", "figma", "app", "components", "xspaces", "utils.test.ts");
  const tsxBin = join(cwd, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const out = spawnSync(tsxBin, [testPath], {
    cwd,
    stdio: "inherit",
    env: { ...process.env },
    shell: process.platform === "win32",
  });
  const status = out.status ?? out.signal ?? -1;
  if (status !== 0) {
    console.error("Date tests failed (exit code " + (out.status ?? "null") + (out.signal ? `, signal ${out.signal}` : "") + ")");
    process.exit(1);
  }

  console.log("Running XSpaces governance grep...");
  if (!governanceCheck()) {
    process.exit(1);
  }
  console.log("All XSpaces regression checks passed.");
}

main();
