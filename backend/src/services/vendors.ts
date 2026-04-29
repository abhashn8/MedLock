import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";
import { requirePermission } from "./rbac.js";

export type VendorRow = {
  id: string;
  name: string;
  baa_status: "PASS" | "WARNING" | "FAIL" | "PENDING";
  baa_signed_at: string | null;
  baa_expires_at: string | null;
  covered_services: string | null;
  risk_score: number | null;
  mou_document_path: string | null;
  mou_uploaded_at: string | null;
  risk_breakdown: Record<string, unknown> | null;
  risk_model_version: string | null;
  risk_computed_at: string | null;
  created_at: string;
};

type VendorStatus = VendorRow["baa_status"];
type VendorSeedRow = {
  name: string;
  baa_status: VendorStatus;
  baa_signed_at: string | null;
  baa_expires_at: string | null;
  covered_services: string | null;
  risk_score: number;
};

type VendorInput = {
  name?: unknown;
  baa_status?: unknown;
  baa_signed_at?: unknown;
  baa_expires_at?: unknown;
  covered_services?: unknown;
  risk_score?: unknown;
};

type VendorMouUploadInput = {
  fileName?: unknown;
  fileContent?: unknown;
  mimeType?: unknown;
};

const VALID_STATUSES: VendorStatus[] = ["PASS", "WARNING", "FAIL", "PENDING"];
const DEFAULT_VENDOR_ROWS: VendorSeedRow[] = [
  {
    name: "Cloud Storage Co",
    baa_status: "PASS",
    baa_signed_at: null,
    baa_expires_at: null,
    covered_services: "Encrypted object storage",
    risk_score: 88,
  },
  {
    name: "Analytics BA",
    baa_status: "WARNING",
    baa_signed_at: null,
    baa_expires_at: null,
    covered_services: "Event analytics and reporting",
    risk_score: 72,
  },
  {
    name: "Billing Partner",
    baa_status: "PASS",
    baa_signed_at: null,
    baa_expires_at: null,
    covered_services: "Claims processing",
    risk_score: 81,
  },
  {
    name: "Supabase",
    baa_status: "WARNING",
    baa_signed_at: "2025-11-01",
    baa_expires_at: "2026-11-01",
    covered_services:
      "PostgreSQL database hosting, authentication, real-time subscriptions, and file storage containing PHI",
    risk_score: 74,
  },
  {
    name: "Render",
    baa_status: "FAIL",
    baa_signed_at: null,
    baa_expires_at: null,
    covered_services: "Application server hosting and deployment pipeline for services that process PHI",
    risk_score: 41,
  },
  {
    name: "Anthropic",
    baa_status: "WARNING",
    baa_signed_at: "2026-01-15",
    baa_expires_at: "2027-01-15",
    covered_services:
      "Claude AI API for PHI leakage detection, compliance report generation, and breach notification drafting",
    risk_score: 68,
  },
  {
    name: "Resend",
    baa_status: "FAIL",
    baa_signed_at: null,
    baa_expires_at: null,
    covered_services:
      "Transactional email delivery for breach notification letters and compliance alerts containing PHI",
    risk_score: 38,
  },
  {
    name: "Datadog",
    baa_status: "PASS",
    baa_signed_at: "2025-08-10",
    baa_expires_at: "2027-08-10",
    covered_services:
      "Application performance monitoring, log aggregation, and SIEM integration for PHI access audit trails",
    risk_score: 85,
  },
  {
    name: "Cloudflare",
    baa_status: "PASS",
    baa_signed_at: "2025-06-18",
    baa_expires_at: "2027-06-18",
    covered_services: "DDoS protection, WAF, TLS termination, and CDN for PHI-bearing application traffic",
    risk_score: 91,
  },
];

async function fetchVendorsForOrganization(context: AuthContext, organizationId: string): Promise<VendorRow[]> {
  const { data, error } = await context.supabase
    .from("vendors")
    .select(
      "id, name, baa_status, baa_signed_at, baa_expires_at, covered_services, risk_score, mou_document_path, mou_uploaded_at, risk_breakdown, risk_model_version, risk_computed_at, created_at",
    )
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) throw new HttpError(500, "vendors_query_failed", error.message);
  return (data ?? []) as VendorRow[];
}

async function ensureDefaultVendors(context: AuthContext, organizationId: string) {
  const payload = DEFAULT_VENDOR_ROWS.map((row) => ({
    organization_id: organizationId,
    ...row,
  }));
  const { error } = await context.supabase.from("vendors").upsert(payload, {
    onConflict: "organization_id,name",
  });
  if (error) throw new HttpError(500, "vendors_seed_failed", error.message);
}

function parseOptionalDate(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_request", `${field} must be a date string (YYYY-MM-DD) or null.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "invalid_request", `${field} is not a valid date.`);
  }
  return value.slice(0, 10);
}

function parseOptionalRiskScore(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new HttpError(400, "invalid_request", "risk_score must be between 0 and 100.");
  }
  return parsed;
}

function parseStatus(value: unknown): VendorStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !VALID_STATUSES.includes(value as VendorStatus)) {
    throw new HttpError(
      400,
      "invalid_request",
      "baa_status must be one of PASS, WARNING, FAIL, or PENDING.",
    );
  }
  return value as VendorStatus;
}

function buildVendorPayload(input: VendorInput, mode: "create" | "update") {
  const payload: Record<string, unknown> = {};

  if (mode === "create" || input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) throw new HttpError(400, "invalid_request", "name is required.");
    payload.name = name;
  }

  const status = parseStatus(input.baa_status);
  if (status !== undefined) payload.baa_status = status;

  const signed = parseOptionalDate(input.baa_signed_at, "baa_signed_at");
  if (signed !== undefined) payload.baa_signed_at = signed;

  const expires = parseOptionalDate(input.baa_expires_at, "baa_expires_at");
  if (expires !== undefined) payload.baa_expires_at = expires;

  if (input.covered_services !== undefined) {
    if (input.covered_services === null) {
      payload.covered_services = null;
    } else if (typeof input.covered_services === "string") {
      payload.covered_services = input.covered_services.trim() || null;
    } else {
      throw new HttpError(400, "invalid_request", "covered_services must be a string or null.");
    }
  }

  const risk = parseOptionalRiskScore(input.risk_score);
  if (risk !== undefined) payload.risk_score = risk;

  payload.updated_at = new Date().toISOString();
  return payload;
}

export async function listVendors(context: AuthContext): Promise<VendorRow[]> {
  const actor = await requirePermission(context, "baa_tracker", "read_only");
  const rows = await fetchVendorsForOrganization(context, actor.organization_id);
  if (rows.length > 0) return rows;

  await ensureDefaultVendors(context, actor.organization_id);
  return fetchVendorsForOrganization(context, actor.organization_id);
}

export async function createVendor(
  context: AuthContext,
  input: VendorInput,
): Promise<VendorRow> {
  const actor = await requirePermission(context, "baa_tracker", "full");
  const payload = buildVendorPayload(input, "create");

  const { data, error } = await context.supabase
    .from("vendors")
    .insert({
      organization_id: actor.organization_id,
      ...payload,
    })
    .select(
      "id, name, baa_status, baa_signed_at, baa_expires_at, covered_services, risk_score, mou_document_path, mou_uploaded_at, risk_breakdown, risk_model_version, risk_computed_at, created_at",
    )
    .single();

  if (error) throw new HttpError(500, "vendor_create_failed", error.message);
  return data as VendorRow;
}

export async function updateVendor(
  context: AuthContext,
  vendorId: string,
  input: VendorInput,
): Promise<VendorRow> {
  const actor = await requirePermission(context, "baa_tracker", "full");
  const payload = buildVendorPayload(input, "update");
  const keys = Object.keys(payload).filter((key) => key !== "updated_at");
  if (keys.length === 0) {
    throw new HttpError(400, "invalid_request", "At least one updatable field is required.");
  }

  const { data, error } = await context.supabase
    .from("vendors")
    .update(payload)
    .eq("organization_id", actor.organization_id)
    .eq("id", vendorId)
    .select(
      "id, name, baa_status, baa_signed_at, baa_expires_at, covered_services, risk_score, mou_document_path, mou_uploaded_at, risk_breakdown, risk_model_version, risk_computed_at, created_at",
    )
    .maybeSingle();

  if (error) throw new HttpError(500, "vendor_update_failed", error.message);
  if (!data) throw new HttpError(404, "not_found", "Vendor not found.");
  return data as VendorRow;
}

export async function uploadVendorMou(
  context: AuthContext,
  vendorId: string,
  input: VendorMouUploadInput,
): Promise<VendorRow> {
  const actor = await requirePermission(context, "baa_tracker", "full");
  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : "";
  const fileContent = typeof input.fileContent === "string" ? input.fileContent.trim() : "";
  const mimeType = typeof input.mimeType === "string" ? input.mimeType.trim() : "";

  if (!fileName) throw new HttpError(400, "invalid_request", "fileName is required.");
  if (!fileContent) throw new HttpError(400, "invalid_request", "fileContent is required.");
  if (!mimeType) throw new HttpError(400, "invalid_request", "mimeType is required.");

  const lowerMime = mimeType.toLowerCase();
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(lowerMime)) {
    throw new HttpError(400, "invalid_request", "Only PDF, DOC, and DOCX files are allowed.");
  }

  const { data: existing, error: existingError } = await context.supabase
    .from("vendors")
    .select("id, name")
    .eq("organization_id", actor.organization_id)
    .eq("id", vendorId)
    .maybeSingle();

  if (existingError) throw new HttpError(500, "vendor_lookup_failed", existingError.message);
  if (!existing) throw new HttpError(404, "not_found", "Vendor not found.");

  let buffer: Buffer;
  try {
    buffer = Buffer.from(fileContent, "base64");
  } catch {
    throw new HttpError(400, "invalid_request", "fileContent must be a valid base64 string.");
  }
  if (!buffer.length) throw new HttpError(400, "invalid_request", "Uploaded file is empty.");

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${actor.organization_id}/${vendorId}/mou-${Date.now()}-${safeFileName}`;
  const upload = await context.supabase.storage.from("vendor-documents").upload(storagePath, buffer, {
    contentType: lowerMime,
    upsert: true,
  });

  if (upload.error) {
    const msg = upload.error.message?.toLowerCase() ?? "";
    if (msg.includes("bucket") && msg.includes("not found")) {
      throw new HttpError(
        500,
        "storage_bucket_missing",
        "Storage bucket `vendor-documents` was not found. Create it in Supabase Storage first.",
      );
    }
    throw new HttpError(500, "vendor_mou_upload_failed", upload.error.message);
  }

  const now = new Date().toISOString();
  const { data, error } = await context.supabase
    .from("vendors")
    .update({
      mou_document_path: storagePath,
      mou_uploaded_at: now,
      updated_at: now,
    })
    .eq("organization_id", actor.organization_id)
    .eq("id", vendorId)
    .select(
      "id, name, baa_status, baa_signed_at, baa_expires_at, covered_services, risk_score, mou_document_path, mou_uploaded_at, risk_breakdown, risk_model_version, risk_computed_at, created_at",
    )
    .maybeSingle();

  if (error) throw new HttpError(500, "vendor_update_failed", error.message);
  if (!data) throw new HttpError(404, "not_found", "Vendor not found after upload.");
  return data as VendorRow;
}

export async function getVendorMouSignedUrl(
  context: AuthContext,
  vendorId: string,
  expiresSeconds = 3600,
): Promise<{ url: string; expiresIn: number }> {
  const actor = await requirePermission(context, "baa_tracker", "read_only");

  const { data: vendor, error } = await context.supabase
    .from("vendors")
    .select("mou_document_path")
    .eq("organization_id", actor.organization_id)
    .eq("id", vendorId)
    .maybeSingle();

  if (error) throw new HttpError(500, "vendor_lookup_failed", error.message);
  if (!vendor?.mou_document_path) {
    throw new HttpError(404, "not_found", "No MOU document has been uploaded for this vendor yet.");
  }

  const signed = await context.supabase.storage
    .from("vendor-documents")
    .createSignedUrl(vendor.mou_document_path as string, expiresSeconds);

  if (signed.error) {
    throw new HttpError(500, "vendor_mou_signed_url_failed", signed.error.message);
  }
  if (!signed.data?.signedUrl) {
    throw new HttpError(500, "vendor_mou_signed_url_failed", "Signed URL was not returned.");
  }

  return { url: signed.data.signedUrl, expiresIn: expiresSeconds };
}
