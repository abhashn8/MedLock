import { addMonths, differenceInDays } from "date-fns";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../supabase.js";
import { HttpError } from "../http-error.js";

const ALLOWED_PHI_TYPES = new Set([
  "ssn",
  "mrn",
  "dob",
  "name",
  "email",
  "phone",
  "fax",
  "address",
  "zip",
  "dates",
  "age_over_89",
  "diagnosis",
  "insurance_id",
  "account_number",
  "certificate_number",
  "device_identifier",
  "ip_address",
  "biometric",
  "photo",
  "url",
  "bank_account",
  "other",
]);

async function getOrganizationId(context: AuthContext): Promise<string> {
  let { data, error } = await context.supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", context.user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "organization_lookup_failed", error.message);
  }
  if (!data?.organization_id) {
    const orgName = `MedLock - ${context.user.email ?? context.user.id}`;
    const { error: bootstrapError } = await context.supabase.rpc(
      "bootstrap_organization_for_current_user",
      { org_name: orgName },
    );
    if (bootstrapError) {
      throw new HttpError(500, "organization_bootstrap_failed", bootstrapError.message);
    }
    const retry = await context.supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", context.user.id)
      .limit(1)
      .maybeSingle();
    if (retry.error) {
      throw new HttpError(500, "organization_lookup_failed", retry.error.message);
    }
    if (!retry.data?.organization_id) {
      throw new HttpError(404, "organization_not_found", "No organization membership found.");
    }
    return retry.data.organization_id as string;
  }
  return data.organization_id as string;
}

export type PhiSystemRow = Record<string, unknown>;

export function computeStatus(system: {
  business_owner_id: string | null;
  technical_owner_id: string | null;
  retention_years: number | null;
  next_review_due_at: string | null;
}): "active" | "needs_review" | "at_risk" {
  const missingOwner = !system.business_owner_id || !system.technical_owner_id;
  const missingRetention = system.retention_years == null;
  const reviewOverdue = system.next_review_due_at
    ? new Date(system.next_review_due_at) < new Date()
    : true;

  if (missingOwner && missingRetention) return "at_risk";
  if (missingOwner || missingRetention || reviewOverdue) return "needs_review";
  return "active";
}

export const HIPAA_GAP_CITATIONS: Record<string, string> = {
  missing_business_owner: "§164.308(a)(2) — Assigned security responsibility",
  missing_technical_owner: "§164.308(a)(2) — Assigned security responsibility",
  missing_retention_policy: "§164.316(b)(2) — Documentation retention",
  review_overdue: "§164.308(a)(1)(ii)(A) — Risk analysis must be reviewed periodically",
  missing_encryption_at_rest: "§164.312(a)(2)(iv) — Encryption and decryption (addressable)",
  missing_encryption_in_transit: "§164.312(e)(2)(ii) — Encryption in transit (addressable)",
  access_control_none: "§164.312(a)(1) — Access control",
  missing_baa: "§164.308(b)(1) — Business associate contracts",
};

export const STATE_RETENTION_GUIDANCE: Record<string, string> = {
  NJ: "NJ: 10 years for adults, age of majority + 7 for minors",
  NY: "NY: 6 years",
  CA: "CA: 7 years",
  FEDERAL: "Federal HIPAA minimum: 6 years",
};

function cadenceToMonths(cadence: string): number {
  if (cadence === "quarterly") return 3;
  if (cadence === "semi_annual") return 6;
  return 12;
}

export function computeNextReviewDueAt(
  lastReviewedAt: Date | string | null,
  cadence: string,
): string | null {
  if (!lastReviewedAt) return null;
  const d = typeof lastReviewedAt === "string" ? new Date(lastReviewedAt) : lastReviewedAt;
  return addMonths(d, cadenceToMonths(cadence)).toISOString();
}

export function computeRiskScore(system: {
  classification?: string | null;
  phi_types?: string[] | null;
  business_owner_id?: string | null;
  technical_owner_id?: string | null;
  retention_years?: number | null;
  encryption_at_rest?: boolean | null;
  encryption_in_transit?: boolean | null;
  access_control_method?: string | null;
  next_review_due_at?: string | null;
}): number {
  let score = 0;
  const classWeight: Record<string, number> = {
    clinical: 40,
    direct_identifier: 35,
    financial: 30,
    contact: 20,
    derived: 10,
  };
  score += classWeight[String(system.classification ?? "")] ?? 10;

  const highRiskTypes = new Set(["ssn", "diagnosis", "biometric", "bank_account"]);
  const medRiskTypes = new Set(["mrn", "dob", "insurance_id", "account_number"]);
  for (const t of system.phi_types ?? []) {
    if (highRiskTypes.has(t)) score += 8;
    else if (medRiskTypes.has(t)) score += 4;
    else score += 1;
  }

  if (!system.business_owner_id) score += 15;
  if (!system.technical_owner_id) score += 15;
  if (!system.retention_years) score += 10;
  if (!system.encryption_at_rest) score += 8;
  if (!system.encryption_in_transit) score += 8;
  if (system.access_control_method === "none") score += 10;

  if (system.next_review_due_at) {
    const daysOverdue = differenceInDays(new Date(), new Date(system.next_review_due_at));
    if (daysOverdue > 0) score += Math.min(daysOverdue, 20);
  } else {
    score += 20;
  }
  return Math.min(score, 100);
}

function normalizePhiType(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (ALLOWED_PHI_TYPES.has(t)) return t;
  return "other";
}

function stripSystemForClient(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row };
}

async function attachOwnerNames(
  context: AuthContext,
  systems: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const ids = new Set<string>();
  for (const s of systems) {
    if (typeof s.business_owner_id === "string") ids.add(s.business_owner_id);
    if (typeof s.technical_owner_id === "string") ids.add(s.technical_owner_id);
  }
  if (ids.size === 0) return systems.map((s) => ({ ...s, business_owner_name: null, technical_owner_name: null }));

  const { data: profiles, error } = await context.supabase
    .from("user_profiles")
    .select("user_id, full_name")
    .in("user_id", [...ids]);

  if (error) {
    throw new HttpError(500, "user_profiles_query_failed", error.message);
  }
  const nameById = new Map<string, string | null>();
  for (const p of profiles ?? []) {
    nameById.set(String((p as { user_id: string }).user_id), (p as { full_name: string | null }).full_name);
  }

  return systems.map((s) => ({
    ...s,
    business_owner_name: typeof s.business_owner_id === "string" ? nameById.get(s.business_owner_id) ?? null : null,
    technical_owner_name:
      typeof s.technical_owner_id === "string" ? nameById.get(s.technical_owner_id) ?? null : null,
    days_until_review:
      s.next_review_due_at && typeof s.next_review_due_at === "string"
        ? Math.ceil((new Date(s.next_review_due_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
  }));
}

export type InventoryListFilters = {
  search?: string;
  classification?: string;
  department?: string;
  retention_status?: string;
  owner_status?: string;
  status?: string;
  source?: string;
  page?: number;
  limit?: number;
};

export async function listPhiInventory(
  context: AuthContext,
  filters: InventoryListFilters,
): Promise<{
  items: Record<string, unknown>[];
  total: number;
  stats: {
    systemsCataloged: number;
    missingOwners: number;
    retentionGaps: number;
    reviewOverdue: number;
  };
  departments: string[];
}> {
  const organizationId = await getOrganizationId(context);
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let baseQuery = context.supabase
    .from("phi_systems")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters.status === "all" || !filters.status) {
    baseQuery = baseQuery.neq("status", "decommissioned");
  } else {
    baseQuery = baseQuery.eq("status", filters.status);
  }

  if (filters.classification && filters.classification !== "all") {
    baseQuery = baseQuery.eq("classification", filters.classification);
  }
  if (filters.department && filters.department !== "all") {
    baseQuery = baseQuery.eq("department", filters.department);
  }
  if (filters.source && filters.source !== "all") {
    baseQuery = baseQuery.eq("source", filters.source);
  }
  if (filters.retention_status === "policy_set") {
    baseQuery = baseQuery.not("retention_years", "is", null);
  } else if (filters.retention_status === "missing_policy") {
    baseQuery = baseQuery.is("retention_years", null);
  }
  if (filters.owner_status === "missing_owner") {
    baseQuery = baseQuery.or("business_owner_id.is.null,technical_owner_id.is.null");
  } else if (filters.owner_status === "owner_assigned") {
    baseQuery = baseQuery.not("business_owner_id", "is", null);
    baseQuery = baseQuery.not("technical_owner_id", "is", null);
  }
  if (filters.search?.trim()) {
    const raw = filters.search.trim().replace(/%/g, "\\%").replace(/,/g, " ");
    const q = `%${raw}%`;
    baseQuery = baseQuery.or(`name.ilike.${q},department.ilike.${q},notes.ilike.${q}`);
  }

  baseQuery = baseQuery.order("risk_score", { ascending: false }).order("updated_at", { ascending: false }).range(from, to);

  const { data: rows, error, count } = await baseQuery;
  if (error) throw new HttpError(500, "phi_systems_list_failed", error.message);

  const { data: allForMeta } = await context.supabase
    .from("phi_systems")
    .select("department,status,retention_years,business_owner_id,technical_owner_id,next_review_due_at")
    .eq("organization_id", organizationId)
    .neq("status", "decommissioned");

  const meta = allForMeta ?? [];
  const departments = [...new Set(meta.map((r) => String((r as { department: string }).department || "")).filter(Boolean))].sort();

  const now = new Date();
  const systemsCataloged = meta.filter((r) => (r as { status: string }).status !== "decommissioned").length;
  const missingOwners = meta.filter(
    (r) => !(r as { business_owner_id: string | null }).business_owner_id || !(r as { technical_owner_id: string | null }).technical_owner_id,
  ).length;
  const retentionGaps = meta.filter((r) => (r as { retention_years: number | null }).retention_years == null).length;
  const reviewOverdue = meta.filter((r) => {
    const n = (r as { next_review_due_at: string | null }).next_review_due_at;
    return !n || new Date(n) < now;
  }).length;

  const items = await attachOwnerNames(context, (rows ?? []) as Record<string, unknown>[]);

  return {
    items: items.map(stripSystemForClient),
    total: count ?? 0,
    stats: {
      systemsCataloged,
      missingOwners,
      retentionGaps,
      reviewOverdue,
    },
    departments,
  };
}

export async function getPhiInventoryCoverage(context: AuthContext): Promise<
  { phi_type: string; system_count: number; systems: { id: string; name: string }[] }[]
> {
  const organizationId = await getOrganizationId(context);
  const { data: rows, error } = await context.supabase
    .from("phi_systems")
    .select("id, name, phi_types")
    .eq("organization_id", organizationId)
    .neq("status", "decommissioned");

  if (error) throw new HttpError(500, "phi_systems_coverage_failed", error.message);

  const byType = new Map<string, { id: string; name: string }[]>();
  for (const row of rows ?? []) {
    const id = String((row as { id: string }).id);
    const name = String((row as { name: string }).name);
    const types = ((row as { phi_types: string[] | null }).phi_types ?? []) as string[];
    for (const t of types) {
      const key = normalizePhiType(t);
      const list = byType.get(key) ?? [];
      if (!list.some((x) => x.id === id)) list.push({ id, name });
      byType.set(key, list);
    }
  }

  return [...byType.entries()]
    .map(([phi_type, systems]) => ({
      phi_type,
      system_count: systems.length,
      systems,
    }))
    .sort((a, b) => b.system_count - a.system_count);
}

function prepareSystemPayload(body: Record<string, unknown>, organizationId: string): Record<string, unknown> {
  const allowed = [
    "name",
    "description",
    "system_type",
    "host_or_url",
    "department",
    "classification",
    "phi_types",
    "business_owner_id",
    "technical_owner_id",
    "encryption_at_rest",
    "encryption_at_rest_method",
    "encryption_in_transit",
    "encryption_in_transit_protocol",
    "access_control_method",
    "baa_required",
    "baa_id",
    "retention_years",
    "retention_legal_basis",
    "retention_notes",
    "review_cadence",
    "last_reviewed_at",
    "source",
    "phi_scan_id",
    "notes",
    "state_jurisdiction",
    "decommission_method",
    "decommission_date",
    "decommission_authorized_by",
    "decommission_successor_system",
    "decommission_legal_hold_ref",
    "decommission_notes",
    "decommission_certificate_number",
  ];
  const out: Record<string, unknown> = { organization_id: organizationId };
  for (const k of allowed) {
    if (k in body) out[k] = body[k];
  }
  if (Array.isArray(out.phi_types)) {
    out.phi_types = [...new Set((out.phi_types as unknown[]).map((x) => normalizePhiType(String(x))))];
  }
  if (typeof out.retention_years === "string" && out.retention_years.trim()) {
    const n = Number(out.retention_years);
    out.retention_years = Number.isFinite(n) ? n : null;
  }
  return out;
}

function validateRetentionPolicy(row: Record<string, unknown>): { warning?: string } {
  const retentionYears =
    typeof row.retention_years === "number" ? row.retention_years : row.retention_years == null ? null : Number(row.retention_years);
  if (retentionYears == null) return {};
  if (retentionYears < 3) {
    throw new HttpError(
      400,
      "retention_policy_invalid",
      "HIPAA §164.316(b)(2) requires a minimum 6-year retention period for most PHI records. Set retention_years to 6 or above, or document a legal basis for a shorter period.",
    );
  }
  if (retentionYears < 6) {
    const basis = String(row.retention_legal_basis ?? "");
    if (basis !== "state_law") {
      throw new HttpError(
        400,
        "retention_policy_invalid",
        "HIPAA §164.316(b)(2) requires a minimum 6-year retention period for most PHI records. Set retention_years to 6 or above, or document a legal basis for a shorter period.",
      );
    }
    return {
      warning: "Below HIPAA minimum of 6 years. Verify your state law allows this.",
    };
  }
  return {};
}

function applyComputedFields(row: Record<string, unknown>): Record<string, unknown> {
  if (row.status === "decommissioned") {
    return row;
  }
  const cadence = String(row.review_cadence ?? "annual");
  const last = row.last_reviewed_at as string | null | undefined;
  row.next_review_due_at = last ? computeNextReviewDueAt(last, cadence) : null;
  row.status = computeStatus({
    business_owner_id: (row.business_owner_id as string | null) ?? null,
    technical_owner_id: (row.technical_owner_id as string | null) ?? null,
    retention_years: (row.retention_years as number | null) ?? null,
    next_review_due_at: (row.next_review_due_at as string | null) ?? null,
  });
  row.risk_score = computeRiskScore({
    classification: (row.classification as string | null) ?? null,
    phi_types: ((row.phi_types as string[] | null) ?? []) as string[],
    business_owner_id: (row.business_owner_id as string | null) ?? null,
    technical_owner_id: (row.technical_owner_id as string | null) ?? null,
    retention_years: (row.retention_years as number | null) ?? null,
    encryption_at_rest: (row.encryption_at_rest as boolean | null) ?? false,
    encryption_in_transit: (row.encryption_in_transit as boolean | null) ?? false,
    access_control_method: (row.access_control_method as string | null) ?? null,
    next_review_due_at: (row.next_review_due_at as string | null) ?? null,
  });
  return row;
}

export async function createPhiSystem(context: AuthContext, body: Record<string, unknown>): Promise<unknown> {
  const organizationId = await getOrganizationId(context);
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    throw new HttpError(400, "invalid_request", "name is required");
  }
  let row = prepareSystemPayload(body, organizationId);
  const retentionValidation = validateRetentionPolicy(row);
  row = applyComputedFields({ ...row });

  const { data, error } = await context.supabase.from("phi_systems").insert(row).select("*").single();
  if (error) throw new HttpError(500, "phi_system_insert_failed", error.message);
  const [withNames] = await attachOwnerNames(context, [data as Record<string, unknown>]);
  return { ...stripSystemForClient(withNames), retention_warning: retentionValidation.warning ?? null };
}

export async function updatePhiSystem(
  context: AuthContext,
  id: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const organizationId = await getOrganizationId(context);
  const { data: existing, error: fetchErr } = await context.supabase
    .from("phi_systems")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (fetchErr) throw new HttpError(500, "phi_system_fetch_failed", fetchErr.message);
  if (!existing) throw new HttpError(404, "not_found", "System not found");

  const merged = { ...(existing as Record<string, unknown>), ...prepareSystemPayload(body, organizationId) };
  delete merged.id;
  delete merged.organization_id;
  delete merged.created_at;
  const retentionValidation = validateRetentionPolicy(merged);
  const updated = applyComputedFields(merged);

  const { data, error } = await context.supabase
    .from("phi_systems")
    .update(updated)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error) throw new HttpError(500, "phi_system_update_failed", error.message);
  const [withNames] = await attachOwnerNames(context, [data as Record<string, unknown>]);
  return { ...stripSystemForClient(withNames), retention_warning: retentionValidation.warning ?? null };
}

export async function softDeletePhiSystem(context: AuthContext, id: string): Promise<void> {
  const organizationId = await getOrganizationId(context);
  const { error } = await context.supabase
    .from("phi_systems")
    .update({ status: "decommissioned" })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw new HttpError(500, "phi_system_delete_failed", error.message);
}

export async function submitPhiSystemReview(
  context: AuthContext,
  systemId: string,
  body: {
    changes_made?: string;
    reviewer_role?: string;
    cosigner_id?: string | null;
    cosigner_role?: string | null;
    checklist_confirmed?: boolean;
  },
): Promise<unknown> {
  const organizationId = await getOrganizationId(context);
  const { data: system, error: fetchErr } = await context.supabase
    .from("phi_systems")
    .select("*")
    .eq("id", systemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (fetchErr) throw new HttpError(500, "phi_system_fetch_failed", fetchErr.message);
  if (!system) throw new HttpError(404, "not_found", "System not found");

  const cadence = String((system as { review_cadence: string }).review_cadence);
  const now = new Date().toISOString();
  const nextDue = computeNextReviewDueAt(now, cadence);
  if (!nextDue) throw new HttpError(500, "review_schedule_failed", "Could not compute next review date.");

  if (!body.changes_made || !body.changes_made.trim()) {
    throw new HttpError(400, "invalid_request", "changes_made is required");
  }
  if (!body.checklist_confirmed) {
    throw new HttpError(400, "invalid_request", "checklist_confirmed is required");
  }

  const { data: reviewRow, error: revErr } = await context.supabase
    .from("phi_system_reviews")
    .insert({
    organization_id: organizationId,
    system_id: systemId,
    reviewed_by: context.user.id,
    reviewed_at: now,
    changes_made: body.changes_made.trim(),
    reviewer_role: body.reviewer_role ?? null,
    cosigner_id: body.cosigner_id ?? null,
    cosigner_role: body.cosigner_role ?? null,
    cosigned_at: body.cosigner_id ? now : null,
    checklist_confirmed: true,
    certificate_generated_at: now,
    next_review_due_at: nextDue,
    })
    .select("*")
    .single();
  if (revErr) throw new HttpError(500, "phi_system_review_insert_failed", revErr.message);

  await context.supabase.from("phi_system_audit_log").insert({
    organization_id: organizationId,
    system_id: systemId,
    changed_by: context.user.id,
    action: "reviewed",
    field_name: null,
    old_value: null,
    new_value: (reviewRow as { certificate_number?: string | null }).certificate_number ?? null,
  });

  const merged = {
    ...(system as Record<string, unknown>),
    last_reviewed_at: now,
    next_review_due_at: nextDue,
  };
  const updated = applyComputedFields(merged);

  const { data, error } = await context.supabase
    .from("phi_systems")
    .update({
      last_reviewed_at: updated.last_reviewed_at,
      next_review_due_at: updated.next_review_due_at,
      status: updated.status,
    })
    .eq("id", systemId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error) throw new HttpError(500, "phi_system_update_failed", error.message);
  const [withNames] = await attachOwnerNames(context, [data as Record<string, unknown>]);
  return {
    ...stripSystemForClient(withNames),
    review: reviewRow,
  };
}

export async function listPhiSystemReviews(
  context: AuthContext,
  systemId: string,
): Promise<Record<string, unknown>[]> {
  const organizationId = await getOrganizationId(context);
  const { data: rows, error } = await context.supabase
    .from("phi_system_reviews")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("system_id", systemId)
    .order("reviewed_at", { ascending: false });
  if (error) throw new HttpError(500, "phi_system_reviews_list_failed", error.message);

  const ids = new Set<string>();
  for (const r of rows ?? []) {
    ids.add(String((r as { reviewed_by: string }).reviewed_by));
    const cos = (r as { cosigner_id?: string | null }).cosigner_id;
    if (typeof cos === "string" && cos) ids.add(cos);
  }
  const { data: profiles } = await context.supabase
    .from("user_profiles")
    .select("user_id, full_name")
    .in("user_id", [...ids]);
  const nameById = new Map<string, string | null>();
  for (const p of profiles ?? []) {
    nameById.set(String((p as { user_id: string }).user_id), (p as { full_name: string | null }).full_name);
  }

  return (rows ?? []).map((r) => ({
    ...r,
    reviewer_name: nameById.get(String((r as { reviewed_by: string }).reviewed_by)) ?? null,
    cosigner_name:
      typeof (r as { cosigner_id?: string | null }).cosigner_id === "string"
        ? nameById.get(String((r as { cosigner_id: string }).cosigner_id)) ?? null
        : null,
  }));
}

export async function getPhiSystemById(context: AuthContext, id: string): Promise<Record<string, unknown> | null> {
  const organizationId = await getOrganizationId(context);
  const { data, error } = await context.supabase
    .from("phi_systems")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new HttpError(500, "phi_system_fetch_failed", error.message);
  if (!data) return null;
  const [withNames] = await attachOwnerNames(context, [data as Record<string, unknown>]);
  const gaps: Array<{ key: string; citation: string }> = [];
  if (!withNames.business_owner_id) gaps.push({ key: "missing_business_owner", citation: HIPAA_GAP_CITATIONS.missing_business_owner });
  if (!withNames.technical_owner_id) gaps.push({ key: "missing_technical_owner", citation: HIPAA_GAP_CITATIONS.missing_technical_owner });
  if (withNames.retention_years == null) gaps.push({ key: "missing_retention_policy", citation: HIPAA_GAP_CITATIONS.missing_retention_policy });
  if (!withNames.encryption_at_rest) gaps.push({ key: "missing_encryption_at_rest", citation: HIPAA_GAP_CITATIONS.missing_encryption_at_rest });
  if (!withNames.encryption_in_transit) gaps.push({ key: "missing_encryption_in_transit", citation: HIPAA_GAP_CITATIONS.missing_encryption_in_transit });
  if (withNames.access_control_method === "none") gaps.push({ key: "access_control_none", citation: HIPAA_GAP_CITATIONS.access_control_none });
  if (withNames.next_review_due_at == null || new Date(String(withNames.next_review_due_at)) < new Date()) {
    gaps.push({ key: "review_overdue", citation: HIPAA_GAP_CITATIONS.review_overdue });
  }
  if (withNames.baa_required && !withNames.baa_id) gaps.push({ key: "missing_baa", citation: HIPAA_GAP_CITATIONS.missing_baa });
  return { ...stripSystemForClient(withNames), compliance_gaps: gaps };
}

export async function getPhiSystemAuditLog(
  context: AuthContext,
  systemId: string,
): Promise<Record<string, unknown>[]> {
  const organizationId = await getOrganizationId(context);
  const { data: system, error: systemErr } = await context.supabase
    .from("phi_systems")
    .select("id")
    .eq("id", systemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (systemErr) throw new HttpError(500, "phi_system_fetch_failed", systemErr.message);
  if (!system) throw new HttpError(404, "not_found", "System not found");

  const { data, error } = await context.supabase
    .from("phi_system_audit_log")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("system_id", systemId)
    .order("changed_at", { ascending: false });
  if (error) throw new HttpError(500, "phi_system_audit_log_query_failed", error.message);

  const ids = [...new Set((data ?? []).map((r) => String((r as { changed_by: string | null }).changed_by || "")).filter(Boolean))];
  const { data: profiles } = ids.length
    ? await context.supabase.from("user_profiles").select("user_id, full_name").in("user_id", ids)
    : { data: [] as unknown[] };
  const nameById = new Map<string, string | null>();
  for (const p of profiles ?? []) {
    nameById.set(String((p as { user_id: string }).user_id), (p as { full_name: string | null }).full_name);
  }

  return (data ?? []).map((row) => ({
    ...row,
    changed_by_name:
      typeof (row as { changed_by?: string | null }).changed_by === "string"
        ? nameById.get((row as { changed_by: string }).changed_by) ?? null
        : null,
  }));
}

export async function getPhiInventoryRiskSummary(context: AuthContext): Promise<Record<string, unknown>> {
  const organizationId = await getOrganizationId(context);
  const { data: rows, error } = await context.supabase
    .from("phi_systems")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "decommissioned")
    .order("risk_score", { ascending: false });
  if (error) throw new HttpError(500, "phi_systems_risk_summary_failed", error.message);

  const list = (rows ?? []) as Record<string, unknown>[];
  const buckets = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const row of list) {
    const risk = Number((row.risk_score as number | null) ?? 0);
    if (risk >= 81) buckets.critical += 1;
    else if (risk >= 61) buckets.high += 1;
    else if (risk >= 31) buckets.medium += 1;
    else buckets.low += 1;
  }
  const top = await attachOwnerNames(context, list.slice(0, 5));
  return { ...buckets, top_risks: top.map(stripSystemForClient) };
}

export async function updatePhiSystemsBulk(
  context: AuthContext,
  input: { ids?: string[]; updates?: Record<string, unknown> },
): Promise<{ updated: number; errors: { id: string; reason: string }[] }> {
  const organizationId = await getOrganizationId(context);
  const ids = (input.ids ?? []).filter((x): x is string => typeof x === "string" && Boolean(x.trim()));
  if (ids.length === 0) throw new HttpError(400, "invalid_request", "ids are required");
  const updates = input.updates ?? {};
  const payload = prepareSystemPayload(updates, organizationId);
  delete payload.organization_id;
  delete payload.id;
  delete payload.created_at;

  const { data: systems, error: fetchErr } = await context.supabase
    .from("phi_systems")
    .select("*")
    .eq("organization_id", organizationId)
    .in("id", ids);
  if (fetchErr) throw new HttpError(500, "phi_systems_bulk_fetch_failed", fetchErr.message);
  const fetched = (systems ?? []) as Record<string, unknown>[];
  if (fetched.length !== ids.length) {
    throw new HttpError(400, "invalid_request", "One or more systems do not belong to your organization.");
  }

  const errors: { id: string; reason: string }[] = [];
  let updated = 0;
  for (const row of fetched) {
    const merged = { ...row, ...payload };
    try {
      validateRetentionPolicy(merged);
      const computed = applyComputedFields(merged);
      const { error } = await context.supabase
        .from("phi_systems")
        .update(computed)
        .eq("id", String(row.id))
        .eq("organization_id", organizationId);
      if (error) {
        errors.push({ id: String(row.id), reason: error.message });
      } else {
        updated += 1;
      }
    } catch (e) {
      errors.push({ id: String(row.id), reason: e instanceof Error ? e.message : "bulk update failed" });
    }
  }
  return { updated, errors };
}

type ImportWarning = { row: number; message: string };
type ImportBlocked = { row: number; reason: string };

export async function importPhiSystems(
  context: AuthContext,
  input: { rows?: Array<Record<string, unknown>> },
): Promise<{ imported: number; warnings: ImportWarning[]; blocked: ImportBlocked[] }> {
  const organizationId = await getOrganizationId(context);
  const rows = input.rows ?? [];
  const warnings: ImportWarning[] = [];
  const blocked: ImportBlocked[] = [];
  const inserts: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] ?? {};
    const name = String(row.name ?? "").trim();
    const classification = String(row.classification ?? "").trim();
    if (!name) {
      blocked.push({ row: i + 1, reason: "Missing required field: name" });
      continue;
    }
    if (!classification) {
      blocked.push({ row: i + 1, reason: "Missing required field: classification" });
      continue;
    }
    const parsed = prepareSystemPayload(
      {
        ...row,
        source: "manual",
        phi_types: String(row.phi_types ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      },
      organizationId,
    );
    if (!Array.isArray(parsed.phi_types) || parsed.phi_types.length === 0) {
      parsed.phi_types = ["other"];
    }
    const originalTypes = String(row.phi_types ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const normalizedTypes = (parsed.phi_types as string[]) ?? [];
    if (originalTypes.length > 0 && originalTypes.some((t) => !normalizedTypes.includes(normalizePhiType(t)))) {
      warnings.push({ row: i + 1, message: "Unrecognized phi_type values mapped to other." });
    }
    try {
      const retention = validateRetentionPolicy(parsed);
      if (retention.warning) warnings.push({ row: i + 1, message: retention.warning });
      inserts.push(applyComputedFields(parsed));
    } catch (e) {
      blocked.push({ row: i + 1, reason: e instanceof Error ? e.message : "Invalid row" });
    }
  }

  if (inserts.length > 0) {
    const { error } = await context.supabase.from("phi_systems").insert(inserts);
    if (error) throw new HttpError(500, "phi_system_import_failed", error.message);
  }
  return { imported: inserts.length, warnings, blocked };
}

export async function decommissionPhiSystem(
  context: AuthContext,
  systemId: string,
  body: {
    method?: string;
    date?: string;
    authorized_by?: string;
    successor_system?: string;
    legal_hold_ref?: string;
    notes?: string;
  },
): Promise<Record<string, unknown>> {
  const organizationId = await getOrganizationId(context);
  if (!body.method) throw new HttpError(400, "invalid_request", "method is required");
  const certificate = `DECOM-${String(randomUUID()).slice(0, 8).toUpperCase()}`;
  const patch = applyComputedFields({
    status: "decommissioned",
    decommission_method: body.method,
    decommission_date: body.date ?? new Date().toISOString().slice(0, 10),
    decommission_authorized_by: body.authorized_by ?? null,
    decommission_successor_system: body.successor_system ?? null,
    decommission_legal_hold_ref: body.legal_hold_ref ?? null,
    decommission_notes: body.notes ?? null,
    decommission_certificate_number: certificate,
  });
  const { data, error } = await context.supabase
    .from("phi_systems")
    .update(patch)
    .eq("id", systemId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error) throw new HttpError(500, "phi_system_decommission_failed", error.message);
  return stripSystemForClient(data as Record<string, unknown>);
}

export async function exportPhiInventoryCsv(
  context: AuthContext,
  filters: InventoryListFilters,
): Promise<{ filename: string; content: string }> {
  const data = await listPhiInventory(context, { ...filters, page: 1, limit: 5000 });
  const header = [
    "name",
    "system_type",
    "classification",
    "phi_types",
    "business_owner_name",
    "technical_owner_name",
    "retention_years",
    "last_reviewed_at",
    "next_review_due_at",
    "risk_score",
    "status",
  ];
  const rows = data.items.map((item) => [
    String(item.name ?? ""),
    String(item.system_type ?? ""),
    String(item.classification ?? ""),
    ((item.phi_types as string[] | undefined) ?? []).join("|"),
    String(item.business_owner_name ?? ""),
    String(item.technical_owner_name ?? ""),
    String(item.retention_years ?? ""),
    String(item.last_reviewed_at ?? ""),
    String(item.next_review_due_at ?? ""),
    String(item.risk_score ?? ""),
    String(item.status ?? ""),
  ]);
  const content = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const filename = `medlock-phi-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  return { filename, content };
}

export async function syncPhiInventoryFromScanner(
  context: AuthContext,
  scanId: string,
): Promise<{ created: number; already_exists: number }> {
  const organizationId = await getOrganizationId(context);
  const { data: scan, error: scanErr } = await context.supabase
    .from("phi_scans")
    .select("id, organization_id")
    .eq("id", scanId)
    .maybeSingle();
  if (scanErr) throw new HttpError(500, "phi_scan_lookup_failed", scanErr.message);
  if (!scan || (scan as { organization_id: string }).organization_id !== organizationId) {
    throw new HttpError(404, "not_found", "Scan not found");
  }

  const { data: findings, error: fErr } = await context.supabase
    .from("phi_findings")
    .select("source, phi_type")
    .eq("scan_id", scanId)
    .eq("organization_id", organizationId);
  if (fErr) throw new HttpError(500, "phi_findings_query_failed", fErr.message);

  const bySource = new Map<string, Set<string>>();
  for (const f of findings ?? []) {
    const src = String((f as { source: string }).source).trim();
    if (!src) continue;
    const pt = normalizePhiType(String((f as { phi_type: string }).phi_type));
    if (!bySource.has(src)) bySource.set(src, new Set());
    bySource.get(src)!.add(pt);
  }

  let created = 0;
  let already_exists = 0;

  for (const [source, typeSet] of bySource) {
    const name = source.length > 500 ? `${source.slice(0, 497)}...` : source;
    const { data: byName } = await context.supabase
      .from("phi_systems")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", name)
      .maybeSingle();
    const { data: byHost } = await context.supabase
      .from("phi_systems")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("host_or_url", source)
      .maybeSingle();
    if (byName || byHost) {
      already_exists += 1;
      continue;
    }

    const phi_types = [...typeSet];
    if (phi_types.length === 0) phi_types.push("other");

    const row = applyComputedFields({
      organization_id: organizationId,
      name,
      description: null,
      system_type: "other",
      host_or_url: source,
      department: "Discovered",
      classification: "derived",
      phi_types,
      business_owner_id: null,
      technical_owner_id: null,
      encryption_at_rest: false,
      encryption_in_transit: false,
      access_control_method: "none",
      baa_required: false,
      retention_years: null,
      review_cadence: "annual",
      last_reviewed_at: null,
      source: "scanner",
      phi_scan_id: scanId,
      notes: "Discovered by PHI Leakage Scanner",
    });

    const { error: insErr } = await context.supabase.from("phi_systems").insert(row);
    if (insErr) {
      if (insErr.message.includes("duplicate") || insErr.code === "23505") {
        already_exists += 1;
      } else {
        throw new HttpError(500, "phi_system_insert_failed", insErr.message);
      }
    } else {
      created += 1;
    }
  }

  return { created, already_exists };
}
