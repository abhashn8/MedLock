import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import type { AuthContext } from "../supabase.js";
import { HttpError } from "../http-error.js";
import { env } from "../env.js";
import { isSmallZipPrefix } from "./deid-utils.js";

let anthropicClient: Anthropic | null = null;

const SAFE_HARBOR_PROMPT = `You are a HIPAA Privacy Rule expert specializing in de-identification under §164.514(b) Safe Harbor method.
Analyze provided dataset columns and return JSON only with:
{
  "overall_result":"pass|fail",
  "row_count":number,
  "column_count":number,
  "columns":[{"name":"","inferred_type":"","phi_type":null,"safe_harbor_item":null,"status":"pass|fail|warning","pattern_detected":"","rows_affected":0,"remediation":null}],
  "findings":[{"identifier_type":"","hipaa_category":"direct|quasi|unique","column_name":"","sample_pattern":"","row_count_affected":0,"severity":"blocker|warning","remediation":"","safe_harbor_item":1}],
  "passed_identifiers":[],
  "failed_identifiers":[],
  "summary":""
}`;

const EXPERT_PROMPT = `You are a biostatistician and HIPAA Privacy Rule expert specializing in §164.514(a) Expert Determination.
Return JSON only:
{
  "overall_result":"pass|fail|needs_expert",
  "reidentification_risk":0.0,
  "risk_label":"low|medium|high|very_high",
  "kanonymity_value":0,
  "ldiversity_satisfied":false,
  "quasi_identifiers":[],
  "row_count":0,
  "column_count":0,
  "columns":[],
  "findings":[],
  "suppression_recommendations":[{"description":"","rows_affected":0,"action":""}],
  "requires_human_expert":false,
  "human_expert_reason":null,
  "summary":""
}`;

function getAnthropicClient(): Anthropic {
  if (!env.anthropicApiKey) throw new HttpError(500, "anthropic_not_configured", "ANTHROPIC_API_KEY missing");
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: env.anthropicApiKey });
  return anthropicClient;
}

export async function getOrganizationId(context: AuthContext): Promise<string> {
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

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i]?.trim() ?? "";
    });
    return row;
  });
}

function parseDataset(data: string): Record<string, unknown>[] {
  const trimmed = data.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
      if (typeof parsed === "object" && parsed != null) return [parsed as Record<string, unknown>];
      return [];
    } catch {
      return parseCsv(trimmed);
    }
  }
  return parseCsv(trimmed);
}

function sanitizeValue(v: unknown): string {
  const raw = String(v ?? "");
  if (/^\d{3}-?\d{2}-?\d{4}$/.test(raw)) return "111-22-3333";
  if (/^[A-Za-z]{2,5}\d{5,10}$/.test(raw)) return "MRN000000";
  if (raw.includes("@")) return "user@example.org";
  if (/^\d{5}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return "2000-01-01";
  return raw.length > 50 ? `${raw.slice(0, 20)}...` : raw;
}

function sanitizeRowsForAnthropic(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = sanitizeValue(v);
    return out;
  });
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) throw new HttpError(500, "anthropic_parse_failed", "No JSON object returned");
  try {
    return JSON.parse(raw.slice(first, last + 1)) as Record<string, unknown>;
  } catch {
    throw new HttpError(500, "anthropic_parse_failed", "Invalid JSON response");
  }
}

async function runAnthropicCheck(
  standard: "safe_harbor" | "expert_determination",
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>> {
  const client = getAnthropicClient();
  const prompt = standard === "safe_harbor" ? SAFE_HARBOR_PROMPT : EXPERT_PROMPT;
  const sample = rows.slice(0, 500);
  const message = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 4096,
    system: prompt,
    messages: [{ role: "user", content: JSON.stringify({ sample_rows: sample }) }],
  });
  const text = message.content
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");
  return extractJsonObject(text);
}

export async function createDeidCheck(
  context: AuthContext,
  input: { dataset_label?: string; standard?: "safe_harbor" | "expert_determination"; data?: string; tool?: "checker" | "deidentifier"; remediation_of?: string | null },
): Promise<Record<string, unknown>> {
  if (!input.dataset_label?.trim()) throw new HttpError(400, "invalid_request", "dataset_label is required");
  if (!input.standard) throw new HttpError(400, "invalid_request", "standard is required");
  if (!input.data?.trim()) throw new HttpError(400, "invalid_request", "data is required");
  const organizationId = await getOrganizationId(context);
  const rows = parseDataset(input.data);
  const sanitizedRows = sanitizeRowsForAnthropic(rows).slice(0, 500);
  const columns = rows[0] ? Object.keys(rows[0]) : [];

  const { data: created, error: createErr } = await context.supabase
    .from("deid_assessments")
    .insert({
      organization_id: organizationId,
      created_by: context.user.id,
      dataset_label: input.dataset_label.trim(),
      standard: input.standard,
      tool: input.tool ?? "checker",
      status: "running",
      row_count: rows.length,
      column_count: columns.length,
      remediation_of: input.remediation_of ?? null,
      columns_detected: columns.map((name) => ({ name, inferred_type: "unknown", phi_type: null })),
    })
    .select("*")
    .single();
  if (createErr || !created) throw new HttpError(500, "deid_assessment_insert_failed", createErr?.message);

  try {
    const analysis = await runAnthropicCheck(input.standard, sanitizedRows);
    const findings = (analysis.findings as unknown[]) ?? [];
    const overall = String(analysis.overall_result ?? "fail");
    const status = overall === "pass" ? "pass" : overall === "needs_expert" ? "needs_expert" : "fail";
    const { error: updateErr } = await context.supabase
      .from("deid_assessments")
      .update({
        status,
        findings,
        columns_detected: analysis.columns ?? [],
        identifier_count: findings.length,
        passed_identifiers: analysis.passed_identifiers ?? [],
        failed_identifiers: analysis.failed_identifiers ?? [],
        reidentification_risk: analysis.reidentification_risk ?? null,
        kanonymity_value: analysis.kanonymity_value ?? null,
        quasi_identifiers: analysis.quasi_identifiers ?? [],
        completed_at: new Date().toISOString(),
      })
      .eq("id", String(created.id));
    if (updateErr) throw new HttpError(500, "deid_assessment_update_failed", updateErr.message);
    return {
      assessment_id: created.id,
      status,
      findings,
      overall_result: analysis.overall_result ?? status,
      sampled_rows: sanitizedRows.length,
    };
  } catch (err) {
    await context.supabase
      .from("deid_assessments")
      .update({ status: "error", completed_at: new Date().toISOString() })
      .eq("id", String(created.id));
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, "deid_check_failed", err instanceof Error ? err.message : "deid check failed");
  }
}

export async function getDeidCheck(context: AuthContext, id: string): Promise<Record<string, unknown>> {
  const organizationId = await getOrganizationId(context);
  const { data, error } = await context.supabase
    .from("deid_assessments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new HttpError(500, "deid_assessment_fetch_failed", error.message);
  if (!data) throw new HttpError(404, "not_found", "Assessment not found");
  return data as Record<string, unknown>;
}

export async function recheckDeid(
  context: AuthContext,
  id: string,
  input: { data?: string; dataset_label?: string },
): Promise<Record<string, unknown>> {
  const base = await getDeidCheck(context, id);
  return createDeidCheck(context, {
    dataset_label: String(input.dataset_label ?? base.dataset_label ?? "Re-check"),
    standard: String(base.standard) as "safe_harbor" | "expert_determination",
    data: input.data,
    tool: "checker",
    remediation_of: id,
  });
}

async function ensureExpertRole(context: AuthContext): Promise<void> {
  const organizationId = await getOrganizationId(context);
  const { data: membership } = await context.supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id)
    .maybeSingle();
  const role = String((membership as { role?: string } | null)?.role ?? "").toLowerCase();
  if (role === "privacy_officer" || role === "compliance_manager") return;
  const { data: profile } = await context.supabase
    .from("user_profiles")
    .select("role_title")
    .eq("user_id", context.user.id)
    .maybeSingle();
  const roleTitle = String((profile as { role_title?: string } | null)?.role_title ?? "").toLowerCase();
  if (roleTitle.includes("privacy officer") || roleTitle.includes("compliance manager")) return;
  throw new HttpError(403, "forbidden", "Only Privacy Officer or Compliance Manager can complete expert review.");
}

export async function submitExpertReview(
  context: AuthContext,
  id: string,
  input: { expert_reviewer_id?: string; expert_credentials?: string; expert_notes?: string; approved?: boolean },
): Promise<Record<string, unknown>> {
  await ensureExpertRole(context);
  const assessment = await getDeidCheck(context, id);
  const { error } = await context.supabase
    .from("deid_assessments")
    .update({
      expert_reviewer_id: input.expert_reviewer_id ?? context.user.id,
      expert_reviewed_at: new Date().toISOString(),
      expert_credentials: input.expert_credentials ?? null,
      expert_notes: input.expert_notes ?? null,
      status: input.approved ? "pass" : "fail",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new HttpError(500, "deid_expert_review_failed", error.message);
  return { ...assessment, status: input.approved ? "pass" : "fail" };
}

type MappingRow = { column_name: string; phi_type?: string | null; action: string; custom_value?: string | null };

function inferActionFromColumn(column: string): string {
  const c = column.toLowerCase();
  if (c.includes("name") || c.includes("email") || c.includes("phone") || c.includes("address")) return "remove";
  if (c.includes("ssn")) return "mask";
  if (c.includes("mrn") || c.includes("account")) return "hash";
  if (c.includes("dob") || c.includes("birth") || c.includes("date")) return "truncate_year";
  if (c.includes("zip") || c.includes("postal")) return "truncate_zip";
  if (c.includes("age")) return "generalize_age";
  return "keep";
}

function stripLikelyPhiValue(value: unknown): unknown {
  const raw = String(value ?? "");
  if (!raw) return value;
  if (/^\d{3}-?\d{2}-?\d{4}$/.test(raw)) return "[SSN_REDACTED]";
  if (/^[A-Za-z]{1,4}\d{5,12}$/.test(raw)) return "[ID_HASHED]";
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(raw)) return "[EMAIL_REDACTED]";
  if (/\b\d{3}[-.)\s]?\d{3}[-.\s]?\d{4}\b/.test(raw)) return "[PHONE_REDACTED]";
  if (/\b\d{1,5}\s+[A-Za-z0-9.\s]{3,}\b/.test(raw) && raw.toLowerCase().includes("st")) return "[ADDRESS_REDACTED]";
  return value;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(","));
  return [headers.join(","), ...body].join("\n");
}

function applyDeterministicTransform(
  row: Record<string, unknown>,
  mapping: MappingRow[],
): { out: Record<string, unknown>; suppressRow: boolean; transformed: Array<{ column: string; action: string }> } {
  const out: Record<string, unknown> = { ...row };
  let suppressRow = false;
  const transformed: Array<{ column: string; action: string }> = [];

  for (const m of mapping) {
    const col = m.column_name;
    const value = row[col];
    if (m.action === "keep") continue;
    if (m.action === "remove") {
      delete out[col];
      transformed.push({ column: col, action: "remove" });
      continue;
    }
    if (m.action === "mask") {
      out[col] = "[REDACTED]";
      transformed.push({ column: col, action: "mask" });
      continue;
    }
    if (m.action === "hash") {
      out[col] = createHash("sha256").update(String(value ?? "")).digest("hex");
      transformed.push({ column: col, action: "hash" });
      continue;
    }
    if (m.action === "truncate_year") {
      const raw = String(value ?? "");
      const match = raw.match(/^(\d{4})/);
      out[col] = match ? match[1] : raw.slice(0, 4);
      transformed.push({ column: col, action: "truncate_year" });
      continue;
    }
    if (m.action === "generalize_age") {
      const n = Number(value);
      out[col] = Number.isFinite(n) && n > 89 ? "90+" : value;
      transformed.push({ column: col, action: "generalize_age" });
      continue;
    }
    if (m.action === "truncate_zip") {
      const raw = String(value ?? "");
      const prefix = raw.slice(0, 3);
      if (/^\d{3}/.test(prefix) && isSmallZipPrefix(prefix)) {
        suppressRow = true;
      } else {
        out[col] = /^\d{3}/.test(prefix) ? prefix : value;
      }
      transformed.push({ column: col, action: "truncate_zip" });
      continue;
    }
    if (m.action === "suppress") {
      suppressRow = true;
      transformed.push({ column: col, action: "suppress" });
      continue;
    }
    if (m.action === "synthetic") {
      out[col] = null;
      transformed.push({ column: col, action: "synthetic" });
      continue;
    }
  }
  return { out, suppressRow, transformed };
}

async function applySyntheticColumns(
  rows: Record<string, unknown>[],
  mapping: MappingRow[],
): Promise<Record<string, unknown>[]> {
  const syntheticCols = mapping.filter((m) => m.action === "synthetic").map((m) => m.column_name);
  if (syntheticCols.length === 0 || rows.length === 0) return rows;
  const client = getAnthropicClient();
  const prompt = `Generate synthetic replacements for null placeholders for columns: ${syntheticCols.join(", ")}.
Return JSON only: {"rows":[{...}]}`;
  const message = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 4096,
    system: prompt,
    messages: [{ role: "user", content: JSON.stringify({ rows: rows.slice(0, 200), columns: syntheticCols }) }],
  });
  const text = message.content.filter((p) => p.type === "text").map((p) => p.text).join("\n");
  try {
    const parsed = extractJsonObject(text);
    const out = parsed.rows;
    if (Array.isArray(out) && out.length > 0) return out as Record<string, unknown>[];
    return rows;
  } catch {
    return rows.map((row) => {
      const copy = { ...row };
      for (const col of syntheticCols) {
        if (copy[col] == null || copy[col] === "") copy[col] = `synthetic_${col}`;
      }
      return copy;
    });
  }
}

export async function runDeidentifier(
  context: AuthContext,
  input: {
    dataset_label?: string;
    assessment_id?: string;
    data?: string;
    column_mapping?: MappingRow[];
    strict_strip?: boolean;
    ai_assist?: boolean;
  },
): Promise<Record<string, unknown>> {
  const organizationId = await getOrganizationId(context);
  if (!input.dataset_label?.trim()) throw new HttpError(400, "invalid_request", "dataset_label is required");
  if (!input.data?.trim()) throw new HttpError(400, "invalid_request", "data is required");
  const rows = parseDataset(input.data);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const incomingMapping = (input.column_mapping ?? []) as MappingRow[];
  const byCol = new Map(incomingMapping.map((m) => [m.column_name, m]));
  const mapping =
    headers.length > 0
      ? headers.map((h) => byCol.get(h) ?? { column_name: h, action: inferActionFromColumn(h), phi_type: null })
      : incomingMapping;

  const { data: job, error: jobErr } = await context.supabase
    .from("deid_jobs")
    .insert({
      organization_id: organizationId,
      assessment_id: input.assessment_id ?? null,
      created_by: context.user.id,
      dataset_label: input.dataset_label.trim(),
      status: "running",
      row_count: rows.length,
      column_count: headers.length,
      column_mapping: mapping,
    })
    .select("*")
    .single();
  if (jobErr || !job) throw new HttpError(500, "deid_job_insert_failed", jobErr?.message);

  try {
    let suppressed = 0;
    const transformedSummary = new Map<string, { action: string; rows: number }>();
    const deterministicRows: Record<string, unknown>[] = [];
    for (const row of rows) {
      const { out, suppressRow, transformed } = applyDeterministicTransform(row, mapping);
      for (const t of transformed) {
        const key = `${t.column}:${t.action}`;
        const prev = transformedSummary.get(key) ?? { action: t.action, rows: 0 };
        prev.rows += 1;
        transformedSummary.set(key, prev);
      }
      if (suppressRow) {
        suppressed += 1;
      } else {
        deterministicRows.push(out);
      }
    }

    const strictStrip = input.strict_strip !== false;
    const strippedRows = strictStrip
      ? deterministicRows.map((row) => {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) out[k] = stripLikelyPhiValue(v);
          return out;
        })
      : deterministicRows;
    const finalRows = input.ai_assist === false ? strippedRows : await applySyntheticColumns(strippedRows, mapping);
    const csv = toCsv(finalRows);
    const jobId = String(job.id);
    const path = `${organizationId}/${jobId}/output.csv`;
    const upload = await context.supabase.storage.from("deid-outputs").upload(path, Buffer.from(csv, "utf8"), {
      contentType: "text/csv; charset=utf-8",
      upsert: true,
    });
    const uploadFailed = Boolean(upload.error);
    const bucketMissing =
      upload.error?.message?.toLowerCase().includes("bucket") && upload.error?.message?.toLowerCase().includes("not found");
    let signedUrl: string | null = null;
    if (!uploadFailed) {
      const signed = await context.supabase.storage.from("deid-outputs").createSignedUrl(path, 3600);
      if (signed.error || !signed.data?.signedUrl) throw new HttpError(500, "deid_output_signed_url_failed", signed.error?.message);
      signedUrl = signed.data.signedUrl;
    } else if (!bucketMissing) {
      throw new HttpError(500, "deid_output_upload_failed", upload.error?.message);
    }

    const transformations = [...transformedSummary.entries()].map(([key, value]) => {
      const [column] = key.split(":");
      return { column, action: value.action, rows_transformed: value.rows, rows_suppressed: 0, notes: null };
    });

    const { error: doneErr } = await context.supabase
      .from("deid_jobs")
      .update({
        status: "complete",
        transformations_applied: transformations,
        output_row_count: finalRows.length,
        output_column_count: finalRows[0] ? Object.keys(finalRows[0]).length : 0,
        suppressed_rows: suppressed,
        output_storage_path: signedUrl ? path : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    if (doneErr) throw new HttpError(500, "deid_job_update_failed", doneErr.message);

    return {
      job_id: jobId,
      download_url: signedUrl,
      output_csv_base64: signedUrl ? null : Buffer.from(csv, "utf8").toString("base64"),
      transformations_applied: transformations,
      output_row_count: finalRows.length,
      suppressed_row_count: suppressed,
    };
  } catch (err) {
    await context.supabase
      .from("deid_jobs")
      .update({ status: "error", error_message: err instanceof Error ? err.message : "error", completed_at: new Date().toISOString() })
      .eq("id", String(job.id));
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, "deid_run_failed", err instanceof Error ? err.message : "deid run failed");
  }
}

export async function getDeidJob(context: AuthContext, id: string): Promise<Record<string, unknown>> {
  const organizationId = await getOrganizationId(context);
  const { data, error } = await context.supabase
    .from("deid_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new HttpError(500, "deid_job_fetch_failed", error.message);
  if (!data) throw new HttpError(404, "not_found", "Job not found");
  return data as Record<string, unknown>;
}

export async function getDeidHistory(
  context: AuthContext,
  query: { tool?: "checker" | "deidentifier" | "all"; status?: string; page?: number; limit?: number },
): Promise<Record<string, unknown>> {
  const organizationId = await getOrganizationId(context);
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let aQ = context.supabase
    .from("deid_assessments")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (query.status) aQ = aQ.eq("status", query.status);
  if (query.tool && query.tool !== "all") aQ = aQ.eq("tool", query.tool);
  const { data: assessments, error: aErr, count } = await aQ;
  if (aErr) throw new HttpError(500, "deid_history_assessment_failed", aErr.message);

  let jQ = context.supabase
    .from("deid_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (query.status) jQ = jQ.eq("status", query.status);
  if (query.tool === "checker") jQ = jQ.eq("id", "00000000-0000-0000-0000-000000000000");
  const { data: jobs, error: jErr } = await jQ;
  if (jErr) throw new HttpError(500, "deid_history_jobs_failed", jErr.message);

  return {
    assessments: assessments ?? [],
    jobs: jobs ?? [],
    total: count ?? 0,
    page,
    limit,
  };
}

export async function softDeleteAssessment(context: AuthContext, id: string): Promise<void> {
  const organizationId = await getOrganizationId(context);
  const { error } = await context.supabase
    .from("deid_assessments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", id);
  if (error) throw new HttpError(500, "deid_assessment_delete_failed", error.message);
}

function escapeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportDeidAssessmentCsv(
  context: AuthContext,
  id: string,
): Promise<{ filename: string; csv: string }> {
  const assessment = await getDeidCheck(context, id);
  const findings = Array.isArray(assessment.findings)
    ? (assessment.findings as Array<Record<string, unknown>>)
    : [];

  const header = [
    "assessment_id",
    "dataset_label",
    "standard",
    "status",
    "created_at",
    "identifier_type",
    "hipaa_category",
    "safe_harbor_item",
    "column_name",
    "sample_pattern",
    "row_count_affected",
    "severity",
    "remediation",
  ];

  const rows =
    findings.length > 0
      ? findings.map((f) => [
          assessment.id,
          assessment.dataset_label,
          assessment.standard,
          assessment.status,
          assessment.created_at,
          f.identifier_type ?? "",
          f.hipaa_category ?? "",
          f.safe_harbor_item ?? "",
          f.column_name ?? "",
          f.sample_pattern ?? "",
          f.row_count_affected ?? 0,
          f.severity ?? "",
          f.remediation ?? "",
        ])
      : [
          [
            assessment.id,
            assessment.dataset_label,
            assessment.standard,
            assessment.status,
            assessment.created_at,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ],
        ];

  const csv = [header.join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))].join("\n");
  return {
    filename: `medlock-deid-assessment-${String(id).slice(0, 8)}.csv`,
    csv,
  };
}
