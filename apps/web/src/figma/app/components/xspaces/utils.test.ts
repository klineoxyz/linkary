/**
 * Unit tests for XSpaces date/time helpers. Run with: pnpm exec tsx apps/web/src/figma/app/components/xspaces/utils.test.ts
 * Or from apps/web: pnpm exec tsx src/figma/app/components/xspaces/utils.test.ts
 */
import { getDateLabel, formatTime, toLocalYMD } from "./utils";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// --- toLocalYMD
const d1 = new Date(2025, 2, 5); // 5 Mar 2025 local
assert(toLocalYMD(d1) === "2025-03-05", "toLocalYMD 5 Mar");

// --- getDateLabel with explicit now
const nowMar5 = new Date(2025, 2, 5, 12, 0, 0);
assert(getDateLabel("2025-03-05", nowMar5) === "Today", "Today");
assert(getDateLabel("2025-03-06", nowMar5) === "Tomorrow", "Tomorrow");
assert(getDateLabel("2025-03-07", nowMar5) !== "Today" && getDateLabel("2025-03-07", nowMar5) !== "Tomorrow", "Other day");
assert(getDateLabel("2025-03-04", nowMar5) !== "Today", "Yesterday not Today");

// --- formatTime
assert(formatTime(null) === "—", "formatTime null");
assert(formatTime("2025-03-05T14:30:00.000Z").length >= 4, "formatTime returns time string");

// --- Group ordering: Today, Tomorrow, then weekday order by ymd
const nowMar6 = new Date(2025, 2, 6, 12, 0, 0);
const labels = ["2025-03-06", "2025-03-07", "2025-03-10", "2025-03-05"].map((ymd) =>
  getDateLabel(ymd, nowMar6)
);
assert(labels[0] === "Today", "First is Today");
assert(labels[1] === "Tomorrow", "Second is Tomorrow");
assert(labels[2] !== "Today" && labels[2] !== "Tomorrow", "Third is weekday");
assert(labels[3] !== "Today" && labels[3] !== "Tomorrow", "Fourth is weekday");

// --- Late-night UTC: 2025-03-05T02:00:00Z in UTC is 03:00 in Berlin on 5 Mar → local date 2025-03-05
// Run with TZ=Europe/Berlin so that new Date("2025-03-05T02:00:00Z") has getDate() = 5 locally
const lateNightUTC = "2025-03-05T02:00:00.000Z";
const localYMD = toLocalYMD(new Date(lateNightUTC));
// In UTC it would be 2025-03-05 anyway; in Berlin (UTC+1) 02:00 UTC = 03:00 local 5 Mar → 2025-03-05
assert(localYMD === "2025-03-05", "Late-night UTC yields local date 2025-03-05 (or same in UTC)");

// --- DST boundary (Berlin): last Sunday of March 2025 = 30 Mar, 02:00 UTC = 03:00 CET → 04:00 CEST
// So 2025-03-30T01:00:00Z in Berlin is 02:00 CET (before DST), 2025-03-30T02:00:00Z is 04:00 CEST
const beforeDST = new Date("2025-03-30T01:00:00.000Z");
const afterDST = new Date("2025-03-30T03:00:00.000Z");
assert(toLocalYMD(beforeDST).startsWith("2025-03-30"), "Before DST boundary date");
assert(toLocalYMD(afterDST).startsWith("2025-03-30"), "After DST boundary date");

console.log("All date/util tests passed.");
export {};
