export type CsvValue = string | number | null | undefined;

export function csvCell(value: CsvValue) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function buildCsv(rows: CsvValue[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function sanitizeCsvFilename(value: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "export";
}

export function downloadCsv(filename: string, rows: CsvValue[][]) {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
