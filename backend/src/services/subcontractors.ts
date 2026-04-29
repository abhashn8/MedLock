import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";
import { requirePermission } from "./rbac.js";

export type SubBaaStatus = "PASS" | "WARNING" | "FAIL" | "PENDING";

export type SubcontractorRow = {
  id: string;
  vendor_id: string;
  parent_vendor_name: string;
  parent_covered_services: string | null;
  name: string;
  baa_status: SubBaaStatus;
  created_at: string;
};

const VALID_STATUSES: SubBaaStatus[] = ["PASS", "WARNING", "FAIL", "PENDING"];

type SubInput = {
  vendor_id?: unknown;
  name?: unknown;
  baa_status?: unknown;
};

function parseStatus(value: unknown, fallback: SubBaaStatus): SubBaaStatus {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !VALID_STATUSES.includes(value as SubBaaStatus)) {
    throw new HttpError(400, "invalid_request", "baa_status must be PASS, WARNING, FAIL, or PENDING.");
  }
  return value as SubBaaStatus;
}

async function assertVendorInOrg(context: AuthContext, organizationId: string, vendorId: string): Promise<void> {
  const { data, error } = await context.supabase
    .from("vendors")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", vendorId)
    .maybeSingle();

  if (error) throw new HttpError(500, "vendor_lookup_failed", error.message);
  if (!data) throw new HttpError(400, "invalid_request", "Parent vendor not found for this organization.");
}

export async function listSubcontractors(context: AuthContext): Promise<SubcontractorRow[]> {
  const actor = await requirePermission(context, "subcontractor_register", "read_only");
  const orgId = actor.organization_id;

  const { data: vendors, error: vErr } = await context.supabase
    .from("vendors")
    .select("id, name, covered_services")
    .eq("organization_id", orgId);

  if (vErr) throw new HttpError(500, "vendors_query_failed", vErr.message);
  const vendorList = vendors ?? [];
  if (vendorList.length === 0) return [];

  const vendorIds = vendorList.map((v) => v.id as string);
  const vendorMap = new Map(
    vendorList.map((v) => [
      v.id as string,
      { name: v.name as string, covered_services: (v.covered_services as string | null) ?? null },
    ]),
  );

  const { data: subs, error: sErr } = await context.supabase
    .from("vendor_subcontractors")
    .select("id, vendor_id, name, baa_status, created_at")
    .in("vendor_id", vendorIds)
    .order("name", { ascending: true });

  if (sErr) throw new HttpError(500, "subcontractors_query_failed", sErr.message);

  return (subs ?? []).map((row) => {
    const v = vendorMap.get(row.vendor_id as string);
    return {
      id: row.id as string,
      vendor_id: row.vendor_id as string,
      parent_vendor_name: v?.name ?? "Unknown vendor",
      parent_covered_services: v?.covered_services ?? null,
      name: row.name as string,
      baa_status: row.baa_status as SubBaaStatus,
      created_at: row.created_at as string,
    };
  });
}

export async function createSubcontractor(
  context: AuthContext,
  input: SubInput,
): Promise<SubcontractorRow> {
  const actor = await requirePermission(context, "subcontractor_register", "full");
  const orgId = actor.organization_id;

  const vendorId = typeof input.vendor_id === "string" ? input.vendor_id.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!vendorId) throw new HttpError(400, "invalid_request", "vendor_id is required.");
  if (!name) throw new HttpError(400, "invalid_request", "name is required.");

  await assertVendorInOrg(context, orgId, vendorId);
  const baa_status = parseStatus(input.baa_status, "PENDING");

  const { data, error } = await context.supabase
    .from("vendor_subcontractors")
    .insert({ vendor_id: vendorId, name, baa_status })
    .select("id, vendor_id, name, baa_status, created_at")
    .single();

  if (error) throw new HttpError(500, "subcontractor_create_failed", error.message);

  const parent = await context.supabase
    .from("vendors")
    .select("name, covered_services")
    .eq("id", vendorId)
    .eq("organization_id", orgId)
    .single();

  const p = parent.data;
  return {
    id: data.id as string,
    vendor_id: data.vendor_id as string,
    parent_vendor_name: (p?.name as string) ?? "",
    parent_covered_services: (p?.covered_services as string | null) ?? null,
    name: data.name as string,
    baa_status: data.baa_status as SubBaaStatus,
    created_at: data.created_at as string,
  };
}

export async function updateSubcontractor(
  context: AuthContext,
  subId: string,
  input: SubInput,
): Promise<SubcontractorRow> {
  const actor = await requirePermission(context, "subcontractor_register", "full");
  const orgId = actor.organization_id;

  const { data: existing, error: exErr } = await context.supabase
    .from("vendor_subcontractors")
    .select("id, vendor_id, name, baa_status, created_at")
    .eq("id", subId)
    .maybeSingle();

  if (exErr) throw new HttpError(500, "subcontractor_lookup_failed", exErr.message);
  if (!existing) throw new HttpError(404, "not_found", "Subcontractor not found.");

  await assertVendorInOrg(context, orgId, existing.vendor_id as string);

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) throw new HttpError(400, "invalid_request", "name cannot be empty.");
    payload.name = name;
  }
  if (input.baa_status !== undefined) {
    payload.baa_status = parseStatus(input.baa_status, existing.baa_status as SubBaaStatus);
  }

  if (input.vendor_id !== undefined) {
    const vendorId = typeof input.vendor_id === "string" ? input.vendor_id.trim() : "";
    if (!vendorId) throw new HttpError(400, "invalid_request", "vendor_id cannot be empty.");
    await assertVendorInOrg(context, orgId, vendorId);
    payload.vendor_id = vendorId;
  }

  if (Object.keys(payload).length === 0) {
    throw new HttpError(400, "invalid_request", "No updates provided.");
  }

  const { data, error } = await context.supabase
    .from("vendor_subcontractors")
    .update(payload)
    .eq("id", subId)
    .select("id, vendor_id, name, baa_status, created_at")
    .single();

  if (error) throw new HttpError(500, "subcontractor_update_failed", error.message);

  const parent = await context.supabase
    .from("vendors")
    .select("name, covered_services")
    .eq("id", data.vendor_id as string)
    .eq("organization_id", orgId)
    .single();

  const p = parent.data;
  return {
    id: data.id as string,
    vendor_id: data.vendor_id as string,
    parent_vendor_name: (p?.name as string) ?? "",
    parent_covered_services: (p?.covered_services as string | null) ?? null,
    name: data.name as string,
    baa_status: data.baa_status as SubBaaStatus,
    created_at: data.created_at as string,
  };
}
