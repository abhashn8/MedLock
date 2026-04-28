import type { PhiFinding, PhiScan } from "@/lib/api/types";

const BRAND = "MedLock";

export function buildFindingStatusLabel(finding: PhiFinding): string {
  const main =
    finding.status === "open" ? "Open" : finding.status === "resolved" ? "Closed" : "False positive";
  if (finding.owner?.trim()) return `${main}; Assigned: ${finding.owner}`;
  return main;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportFilename(scan: PhiScan | null, ext: string): string {
  const slug = (scan?.source_name ?? "scan")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "scan";
  const day = new Date().toISOString().slice(0, 10);
  return `${BRAND}_phi_findings_${slug}_${day}.${ext}`;
}

function issueText(finding: PhiFinding): string {
  const t = finding.title?.trim() ?? "";
  const d = finding.description?.trim() ?? "";
  if (t && d) return `${t} — ${d}`;
  return d || t || "";
}

export function exportFindingsCsv(findings: PhiFinding[], scan: PhiScan | null): void {
  const headers = [
    "Source",
    "PHI Type",
    "Severity",
    "Line",
    "Evidence",
    "Status",
    "Owner",
    "Title",
    "Description",
    "Recommendation",
  ];
  const rows = findings.map((f) => [
    f.source,
    f.phi_type,
    f.severity,
    f.line_number ?? "",
    f.evidence,
    buildFindingStatusLabel(f),
    f.owner ?? "",
    f.title ?? "",
    f.description ?? "",
    f.recommendation,
  ]);
  const lines = [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))];
  const csv = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFilename(scan, "csv");
  a.click();
  URL.revokeObjectURL(url);
}

/** Dynamic import keeps `xlsx` out of unrelated route chunks and avoids SSR/worker issues. */
export async function exportFindingsXlsx(findings: PhiFinding[], scan: PhiScan | null): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = findings.map((f) => ({
    Source: f.source,
    "PHI Type": f.phi_type,
    Severity: f.severity,
    Line: f.line_number ?? "",
    Evidence: f.evidence,
    Status: buildFindingStatusLabel(f),
    Owner: f.owner ?? "",
    Title: f.title ?? "",
    Description: f.description ?? "",
    Recommendation: f.recommendation,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Findings");
  XLSX.writeFile(wb, exportFilename(scan, "xlsx"));
}

export async function exportFindingsPdf(findings: PhiFinding[], scan: PhiScan | null): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(22, 22, 22);
  doc.text(BRAND, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(72, 72, 72);
  doc.text("PHI Leakage Scanner — Findings export", 14, 23);
  let y = 29;
  if (scan) {
    doc.text(`Scan: ${truncate(scan.source_name, 90)}`, 14, y);
    y += 5;
    doc.text(`Run: ${new Date(scan.created_at).toLocaleString()}`, 14, y);
    y += 5;
  }
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
  y += 7;

  const head = [["Source", "PHI Type", "Severity", "Line", "Evidence", "Status", "Issue", "Remediation"]];
  const body = findings.map((f) => [
    truncate(f.source, 42),
    truncate(f.phi_type, 22),
    f.severity,
    String(f.line_number ?? "—"),
    truncate(f.evidence, 72),
    truncate(buildFindingStatusLabel(f), 40),
    truncate(issueText(f), 64),
    truncate(f.recommendation, 96),
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [22, 78, 99], textColor: 255 },
    margin: { left: 12, right: 12 },
    tableWidth: "auto",
  });

  doc.save(exportFilename(scan, "pdf"));
}
