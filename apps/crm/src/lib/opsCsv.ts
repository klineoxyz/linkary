export function csvEscape(cell: string | number | null | undefined): string {
  const s = cell == null ? "" : String(cell);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  return `${lines.join("\n")}\n`;
}
