import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";

export type ModuleRecord = {
  id: string;
  module_key: string;
  title: string;
  description: string | null;
  status: "PASS" | "FAIL" | "WARNING" | "PENDING";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  due_at: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UpsertModuleRecordInput = {
  module: string;
  title: string;
  description?: string;
  status?: ModuleRecord["status"];
  severity?: ModuleRecord["severity"];
  due_at?: string | null;
  data?: Record<string, unknown>;
};

function assertModule(module: string): string {
  const normalized = module.trim().toLowerCase();
  if (!/^[a-z0-9\-\/_]+$/.test(normalized)) {
    throw new HttpError(400, "invalid_module", "Invalid module key");
  }
  return normalized;
}

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
    data = retry.data;
    error = retry.error;
    if (error) {
      throw new HttpError(500, "organization_lookup_failed", error.message);
    }
    if (!data?.organization_id) {
      throw new HttpError(
        404,
        "organization_not_found",
        "No organization membership found for user.",
      );
    }
  }
  return data.organization_id as string;
}

export async function listModuleRecords(
  context: AuthContext,
  module: string,
): Promise<ModuleRecord[]> {
  const organizationId = await getOrganizationId(context);
  const moduleKey = assertModule(module);

  const { data, error } = await context.supabase
    .from("feature_records")
    .select(
      "id, module_key, title, description, status, severity, due_at, data, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("module_key", moduleKey)
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, "module_records_query_failed", error.message);
  }

  return (data ?? []) as ModuleRecord[];
}

export async function createModuleRecord(
  context: AuthContext,
  input: UpsertModuleRecordInput,
): Promise<ModuleRecord> {
  const organizationId = await getOrganizationId(context);
  const moduleKey = assertModule(input.module);

  if (!input.title?.trim()) {
    throw new HttpError(400, "invalid_request", "title is required");
  }

  const { data, error } = await context.supabase
    .from("feature_records")
    .insert({
      organization_id: organizationId,
      module_key: moduleKey,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: input.status ?? "PENDING",
      severity: input.severity ?? "MEDIUM",
      due_at: input.due_at ?? null,
      data: input.data ?? {},
      created_by: context.user.id,
    })
    .select(
      "id, module_key, title, description, status, severity, due_at, data, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new HttpError(500, "module_record_create_failed", error?.message);
  }
  return data as ModuleRecord;
}

export async function updateModuleRecord(
  context: AuthContext,
  id: string,
  input: Partial<UpsertModuleRecordInput>,
): Promise<ModuleRecord> {
  const organizationId = await getOrganizationId(context);

  if (!id) throw new HttpError(400, "invalid_request", "id is required");
  const patch: Record<string, unknown> = {};

  if (typeof input.title === "string") patch.title = input.title.trim();
  if (typeof input.description === "string") patch.description = input.description.trim();
  if (typeof input.status === "string") patch.status = input.status;
  if (typeof input.severity === "string") patch.severity = input.severity;
  if (input.due_at !== undefined) patch.due_at = input.due_at;
  if (input.data !== undefined) patch.data = input.data;
  if (input.module) patch.module_key = assertModule(input.module);

  const { data, error } = await context.supabase
    .from("feature_records")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select(
      "id, module_key, title, description, status, severity, due_at, data, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new HttpError(500, "module_record_update_failed", error?.message);
  }
  return data as ModuleRecord;
}

export async function deleteModuleRecord(
  context: AuthContext,
  id: string,
): Promise<void> {
  const organizationId = await getOrganizationId(context);

  const { error } = await context.supabase
    .from("feature_records")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    throw new HttpError(500, "module_record_delete_failed", error.message);
  }
}
