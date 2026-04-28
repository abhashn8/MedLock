import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AuthContext } from "../supabase.js";
import { HttpError } from "../http-error.js";
import { getOrganizationId } from "./deid.js";

export async function buildDeidAssessmentReport(
  context: AuthContext,
  assessmentId: string,
): Promise<{ filename: string; bytes: Uint8Array }> {
  const organizationId = await getOrganizationId(context);
  const [{ data: org }, { data: assessment, error }] = await Promise.all([
    context.supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    context.supabase
      .from("deid_assessments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", assessmentId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (error) throw new HttpError(500, "deid_assessment_fetch_failed", error.message);
  if (!assessment) throw new HttpError(404, "not_found", "Assessment not found");

  const row = assessment as Record<string, unknown>;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ref = `DEID-${String(assessmentId).slice(0, 8).toUpperCase()}`;

  function safeText(input: string): string {
    return input.replace(/[^\x20-\x7E]/g, "-");
  }

  function page(title: string, lines: string[]) {
    const p = doc.addPage([612, 792]);
    p.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: rgb(0.05, 0.2, 0.45) });
    p.drawText(safeText("MedLock"), { x: 50, y: 760, size: 16, font: bold, color: rgb(1, 1, 1) });
    p.drawText(safeText(title), { x: 50, y: 715, size: 16, font: bold, color: rgb(0.08, 0.13, 0.2) });
    let y = 685;
    for (const l of lines) {
      if (y < 50) break;
      p.drawText(safeText(l), { x: 50, y, size: 11, font, color: rgb(0.15, 0.18, 0.24) });
      y -= 16;
    }
    p.drawText(safeText(ref), { x: 50, y: 24, size: 8, font, color: rgb(0.4, 0.45, 0.5) });
  }

  page("De-identification Assessment Report - Cover", [
    `Dataset: ${String(row.dataset_label ?? "")}`,
    `Standard: ${String(row.standard ?? "")}`,
    `Result: ${String(row.status ?? "")}`,
    `Organization: ${String((org as { name?: string })?.name ?? "")}`,
    `Assessed by: ${context.user.email ?? context.user.id}`,
    `Assessment date: ${new Date(String(row.created_at ?? new Date().toISOString())).toLocaleString()}`,
    `Document reference: ${ref}`,
  ]);
  page("Summary", [
    String(row.status === "pass" ? "Assessment passed." : "Assessment found de-identification gaps."),
    `Row count analyzed: ${String(row.row_count ?? 0)}`,
    `Column count analyzed: ${String(row.column_count ?? 0)}`,
    `Identifier findings count: ${String(row.identifier_count ?? 0)}`,
    `Expert risk score: ${String(row.reidentification_risk ?? "N/A")}`,
    `k-anonymity value: ${String(row.kanonymity_value ?? "N/A")}`,
  ]);

  const findings = Array.isArray(row.findings) ? (row.findings as Array<Record<string, unknown>>) : [];
  page(
    "Findings detail",
    findings.slice(0, 35).map(
      (f) =>
        `${String(f.identifier_type ?? "")} | item ${String(f.safe_harbor_item ?? "")} | ${String(f.column_name ?? "")} | ${String(f.sample_pattern ?? "")} | ${String(f.row_count_affected ?? 0)} | ${String(f.severity ?? "")}`,
    ),
  );

  page(
    row.standard === "safe_harbor" ? "Safe Harbor checklist" : "Expert Determination analysis",
    row.standard === "safe_harbor"
      ? [
          `Passed identifiers: ${((row.passed_identifiers as string[] | undefined) ?? []).join(", ") || "None"}`,
          `Failed identifiers: ${((row.failed_identifiers as string[] | undefined) ?? []).join(", ") || "None"}`,
        ]
      : [
          `Quasi identifiers: ${((row.quasi_identifiers as string[] | undefined) ?? []).join(", ") || "None"}`,
          `Estimated risk score: ${String(row.reidentification_risk ?? "N/A")}`,
        ],
  );

  page("Certification", [
    "This assessment was conducted using MedLock automated de-identification analysis in accordance with HIPAA Privacy Rule §164.514.",
    "Raw data was not retained. This report documents findings metadata only.",
    row.expert_reviewer_id
      ? `Expert review completed by: ${String(row.expert_reviewer_id)} | credentials: ${String(row.expert_credentials ?? "")}`
      : "Expert review: not completed.",
    "Signature line for Privacy Officer: _________________________________",
  ]);

  const bytes = await doc.save();
  const filename = `medlock-deid-assessment-${String(assessmentId).slice(0, 8)}.pdf`;
  return { filename, bytes };
}
