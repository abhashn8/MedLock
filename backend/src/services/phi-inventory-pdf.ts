import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../supabase.js";
import { HttpError } from "../http-error.js";

async function getOrganizationId(context: AuthContext): Promise<string> {
  const { data, error } = await context.supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", context.user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw new HttpError(500, "organization_lookup_failed", error.message);
  if (!data?.organization_id) throw new HttpError(404, "organization_not_found", "No organization membership found.");
  return String(data.organization_id);
}

type PdfOut = { filename: string; bytes: Uint8Array };

async function addPageWithLines(
  doc: PDFDocument,
  title: string,
  lines: string[],
  opts?: { branded?: boolean; documentRef?: string; generatedAt?: string },
) {
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  if (opts?.branded) {
    page.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: rgb(0.05, 0.2, 0.45) });
    page.drawText("MedLock", { x: 50, y: 760, size: 16, font: bold, color: rgb(1, 1, 1) });
    page.drawText("HIPAA + SOC 2 Compliance Platform", {
      x: 120,
      y: 761,
      size: 9,
      font,
      color: rgb(0.9, 0.95, 1),
    });
    page.drawText(title, { x: 50, y: 720, size: 17, font: bold, color: rgb(0.08, 0.13, 0.2) });
    const footer = `${opts.documentRef ?? ""}${opts.generatedAt ? `  •  Generated ${opts.generatedAt}` : ""}`.trim();
    if (footer) {
      page.drawText(footer, { x: 50, y: 24, size: 8, font, color: rgb(0.35, 0.4, 0.48) });
    }
  } else {
    page.drawText(title, { x: 50, y: 750, size: 18, font: bold, color: rgb(0.08, 0.13, 0.2) });
  }
  let y = opts?.branded ? 690 : 720;
  for (const line of lines) {
    if (y < 60) break;
    page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.12, 0.15, 0.2) });
    y -= 16;
  }
}

export async function buildReviewCertificatePdf(
  context: AuthContext,
  systemId: string,
  reviewId: string,
): Promise<PdfOut> {
  const organizationId = await getOrganizationId(context);
  const { data: org } = await context.supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle();
  const { data: system, error: systemErr } = await context.supabase
    .from("phi_systems")
    .select("*")
    .eq("id", systemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (systemErr) throw new HttpError(500, "phi_system_fetch_failed", systemErr.message);
  if (!system) throw new HttpError(404, "not_found", "System not found");
  const { data: review, error: reviewErr } = await context.supabase
    .from("phi_system_reviews")
    .select("*")
    .eq("id", reviewId)
    .eq("organization_id", organizationId)
    .eq("system_id", systemId)
    .maybeSingle();
  if (reviewErr) throw new HttpError(500, "phi_system_review_fetch_failed", reviewErr.message);
  if (!review) throw new HttpError(404, "not_found", "Review not found");

  const doc = await PDFDocument.create();
  const reviewRow = review as Record<string, unknown>;
  const systemRow = system as Record<string, unknown>;
  await addPageWithLines(doc, "MedLock — PHI System Review Certificate", [
    "----------------------------------------",
    `Certificate number: ${String(reviewRow.certificate_number ?? "N/A")}`,
    `System: ${String(systemRow.name ?? "")}`,
    `Classification: ${String(systemRow.classification ?? "")}`,
    `Organization: ${String((org as { name?: string })?.name ?? "")}`,
    `Review date: ${new Date(String(reviewRow.reviewed_at)).toLocaleString()}`,
    `Next review due: ${new Date(String(reviewRow.next_review_due_at)).toLocaleDateString()}`,
    `Reviewer role: ${String(reviewRow.reviewer_role ?? "N/A")}`,
    `Co-signer role: ${String(reviewRow.cosigner_role ?? "N/A")}`,
    `Changes noted: ${String(reviewRow.changes_made ?? "None")}`,
    "Checklist confirmed: yes",
    "----------------------------------------",
    "This certificate documents completion of a periodic PHI system review",
    "as required by HIPAA §164.308(a)(1)(ii)(A).",
  ]);
  const bytes = await doc.save();
  return {
    filename: `medlock-review-certificate-${String(reviewRow.certificate_number ?? reviewId)}.pdf`,
    bytes,
  };
}

export async function buildDecommissionCertificatePdf(context: AuthContext, systemId: string): Promise<PdfOut> {
  const organizationId = await getOrganizationId(context);
  const { data: org } = await context.supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle();
  const { data: system, error } = await context.supabase
    .from("phi_systems")
    .select("*")
    .eq("id", systemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new HttpError(500, "phi_system_fetch_failed", error.message);
  if (!system) throw new HttpError(404, "not_found", "System not found");

  const row = system as Record<string, unknown>;
  const cert = String(row.decommission_certificate_number ?? `DECOM-${String(systemId).slice(0, 8).toUpperCase()}`);
  const doc = await PDFDocument.create();
  await addPageWithLines(doc, "MedLock — PHI System Decommission Certificate", [
    `System: ${String(row.name ?? "")}`,
    `Organization: ${String((org as { name?: string })?.name ?? "")}`,
    `Decommission date: ${String(row.decommission_date ?? "")}`,
    `PHI disposition: ${String(row.decommission_method ?? "")}`,
    `Authorized by: ${String(row.decommission_authorized_by ?? "")}`,
    `Certificate number: ${cert}`,
    "This certificate documents the decommission and PHI disposition of the above",
    "system in accordance with HIPAA §164.310(d)(2)(i).",
  ]);
  const bytes = await doc.save();
  return { filename: `medlock-decommission-certificate-${cert}.pdf`, bytes };
}

export async function buildAuditPackagePdf(
  context: AuthContext,
  options: { include_decommissioned?: boolean; system_ids?: string[] },
): Promise<PdfOut> {
  const organizationId = await getOrganizationId(context);
  const { data: org } = await context.supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle();

  let q = context.supabase.from("phi_systems").select("*").eq("organization_id", organizationId);
  if (!options.include_decommissioned) q = q.neq("status", "decommissioned");
  if (Array.isArray(options.system_ids) && options.system_ids.length > 0) q = q.in("id", options.system_ids);
  q = q.order("classification").order("risk_score", { ascending: false });
  const { data: systems, error } = await q;
  if (error) throw new HttpError(500, "phi_systems_export_failed", error.message);
  const rows = (systems ?? []) as Record<string, unknown>[];

  const doc = await PDFDocument.create();
  const ref = `AUDIT-${String(randomUUID()).slice(0, 8).toUpperCase()}`;
  const generatedAt = new Date().toLocaleString();
  await addPageWithLines(doc, "MedLock PHI Inventory — Audit Package", [
    `Organization: ${String((org as { name?: string })?.name ?? "")}`,
    `Generated by: ${context.user.email ?? context.user.id}`,
    `Generated at: ${generatedAt}`,
    "Point-in-time snapshot — do not modify",
    `Document reference: ${ref}`,
  ], { branded: true, documentRef: ref, generatedAt });

  const byClass = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const row of rows) {
    byClass.set(String(row.classification ?? "unknown"), (byClass.get(String(row.classification ?? "unknown")) ?? 0) + 1);
    byStatus.set(String(row.status ?? "unknown"), (byStatus.get(String(row.status ?? "unknown")) ?? 0) + 1);
  }
  await addPageWithLines(doc, "Executive Summary", [
    `Total systems: ${rows.length}`,
    `By classification: ${[...byClass.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `By status: ${[...byStatus.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `Systems with missing owners: ${rows.filter((r) => !r.business_owner_id || !r.technical_owner_id).length}`,
    `Systems with missing retention policy: ${rows.filter((r) => r.retention_years == null).length}`,
    `Systems overdue for review: ${rows.filter((r) => !r.next_review_due_at || new Date(String(r.next_review_due_at)) < new Date()).length}`,
  ], { branded: true, documentRef: ref, generatedAt });

  const lines = rows.map(
    (r) =>
      `${String(r.name ?? "")} | ${String(r.system_type ?? "")} | ${String(r.classification ?? "")} | risk:${String(r.risk_score ?? 0)} | ${String(r.status ?? "")}`,
  );
  for (let i = 0; i < lines.length; i += 30) {
    await addPageWithLines(
      doc,
      `System Inventory (${i + 1}-${Math.min(i + 30, lines.length)})`,
      lines.slice(i, i + 30),
      { branded: true, documentRef: ref, generatedAt },
    );
  }
  await addPageWithLines(doc, "Certification Statement", [
    `This document represents an accurate point-in-time record of Protected Health`,
    `Information systems maintained by ${String((org as { name?: string })?.name ?? "")} as of ${new Date().toLocaleDateString()}, generated from`,
    "MedLock compliance management software. This inventory supports compliance with",
    "HIPAA Security Rule §164.308(a)(1)(ii)(A) and §164.316(b)(1).",
    "",
    "Privacy Officer Signature: ____________________________",
    "Security Officer Signature: ___________________________",
  ], { branded: true, documentRef: ref, generatedAt });

  const bytes = await doc.save();
  const orgSlug = String((org as { name?: string })?.name ?? "org")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return {
    filename: `medlock-phi-inventory-${orgSlug || "org"}-${new Date().toISOString().slice(0, 10)}.pdf`,
    bytes,
  };
}
