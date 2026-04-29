import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";
import { env } from "../env.js";
import { requirePermission } from "./rbac.js";

export type AuditEventSource = "app" | "platform";
export type AuditEventSeverity = "critical" | "high" | "medium" | "low" | "info";

export type AuditEventRow = {
  id: string;
  timestamp: string;
  source: AuditEventSource;
  category: string;
  action: string;
  actor: string | null;
  resource: string | null;
  severity: AuditEventSeverity;
  message: string;
  metadata: Record<string, unknown>;
};

export type AuditEventFilters = {
  source?: "app" | "platform" | "all";
  severity?: AuditEventSeverity;
  actor?: string;
  module?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  since?: string;
  page?: number;
  limit?: number;
};

export type AuditEventsResponse = {
  rows: AuditEventRow[];
  page: number;
  limit: number;
  total: number;
  next_since: string | null;
  partial_source_errors: string[];
};

type RoleLogRow = {
  id: string;
  changed_by: string | null;
  target_email: string | null;
  action: string;
  old_role: string | null;
  new_role: string | null;
  reason: string | null;
  created_at: string;
};

type PhiAuditLogRow = {
  id: string;
  system_id: string;
  changed_by: string | null;
  change_reason: string | null;
  changed_at: string;
  change_type?: string | null;
  event_type?: string | null;
  operation?: string | null;
  previous_values?: Record<string, unknown> | null;
  next_values?: Record<string, unknown> | null;
};

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
};

type PhiSystemRow = {
  id: string;
  system_name: string | null;
  name: string | null;
};

type PersistedAuditEventRow = {
  event_uid: string;
  source: AuditEventSource;
  category: string;
  action: string;
  actor: string | null;
  resource: string | null;
  severity: AuditEventSeverity;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
};

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function includeEvent(row: AuditEventRow, filters: AuditEventFilters): boolean {
  if (filters.source && filters.source !== "all" && row.source !== filters.source) return false;
  if (filters.severity && row.severity !== filters.severity) return false;
  if (filters.module && row.category !== filters.module) return false;
  if (filters.action && !row.action.toLowerCase().includes(filters.action.toLowerCase())) return false;
  if (filters.actor && !(row.actor ?? "").toLowerCase().includes(filters.actor.toLowerCase())) return false;

  const from = parseDate(filters.from);
  const to = parseDate(filters.to);
  const ts = new Date(row.timestamp);
  if (from && ts < from) return false;
  if (to && ts > to) return false;

  if (filters.search) {
    const query = filters.search.toLowerCase();
    const haystack = `${row.message} ${row.action} ${row.actor ?? ""} ${row.resource ?? ""}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function normalizeSeverity(input: string | null | undefined): AuditEventSeverity {
  const value = (input ?? "").toLowerCase();
  if (value === "critical") return "critical";
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  if (value === "low") return "low";
  return "info";
}

async function listAppAuditEvents(context: AuthContext, organizationId: string): Promise<AuditEventRow[]> {
  const [roleLogsResult, phiLogsResult] = await Promise.all([
    context.supabase
      .from("role_change_log")
      .select("id, changed_by, target_email, action, old_role, new_role, reason, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(500),
    context.supabase
      .from("phi_system_audit_log")
      .select("*")
      .eq("organization_id", organizationId)
      .order("changed_at", { ascending: false })
      .limit(500),
  ]);

  if (roleLogsResult.error) {
    throw new HttpError(500, "audit_role_log_query_failed", roleLogsResult.error.message);
  }
  if (phiLogsResult.error) {
    throw new HttpError(500, "audit_phi_log_query_failed", phiLogsResult.error.message);
  }

  const roleLogs = (roleLogsResult.data ?? []) as RoleLogRow[];
  const phiLogs = (phiLogsResult.data ?? []) as PhiAuditLogRow[];
  const actorIds = [
    ...new Set(
      [...roleLogs.map((row) => row.changed_by), ...phiLogs.map((row) => row.changed_by)].filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ];
  const systemIds = [...new Set(phiLogs.map((row) => row.system_id).filter(Boolean))];

  const [profilesResult, systemsResult] = await Promise.all([
    actorIds.length > 0
      ? context.supabase.from("user_profiles").select("user_id, full_name").in("user_id", actorIds)
      : Promise.resolve({ data: [] as UserProfileRow[], error: null }),
    systemIds.length > 0
      ? context.supabase.from("phi_systems").select("id, system_name, name").in("id", systemIds)
      : Promise.resolve({ data: [] as PhiSystemRow[], error: null }),
  ]);

  if (profilesResult.error) {
    throw new HttpError(500, "audit_profiles_query_failed", profilesResult.error.message);
  }
  if (systemsResult.error) {
    throw new HttpError(500, "audit_systems_query_failed", systemsResult.error.message);
  }

  const profileNameById = new Map<string, string | null>();
  for (const profile of (profilesResult.data ?? []) as UserProfileRow[]) {
    profileNameById.set(profile.user_id, profile.full_name);
  }

  const systemNameById = new Map<string, string>();
  for (const system of (systemsResult.data ?? []) as PhiSystemRow[]) {
    systemNameById.set(system.id, system.system_name ?? system.name ?? "PHI system");
  }

  const roleEvents: AuditEventRow[] = roleLogs.map((row) => {
    const actorName = row.changed_by ? profileNameById.get(row.changed_by) ?? null : null;
    const fromRole = row.old_role ? ` from ${row.old_role}` : "";
    const toRole = row.new_role ? ` to ${row.new_role}` : "";
    const target = row.target_email ? ` (${row.target_email})` : "";
    const reason = row.reason ? ` Reason: ${row.reason}` : "";
    return {
      id: `role:${row.id}`,
      timestamp: row.created_at,
      source: "app",
      category: "role_management",
      action: row.action,
      actor: actorName,
      resource: row.target_email,
      severity: row.action === "removed" || row.action === "suspended" ? "high" : "info",
      message: `Role event ${row.action}${fromRole}${toRole}${target}.${reason}`.trim(),
      metadata: {
        target_email: row.target_email,
        old_role: row.old_role,
        new_role: row.new_role,
        reason: row.reason,
      },
    };
  });

  const phiEvents: AuditEventRow[] = phiLogs.map((row) => {
    const actorName = row.changed_by ? profileNameById.get(row.changed_by) ?? null : null;
    const systemName = systemNameById.get(row.system_id) ?? row.system_id;
    const action = row.change_type ?? row.event_type ?? row.operation ?? "updated";
    return {
      id: `phi:${row.id}`,
      timestamp: row.changed_at,
      source: "app",
      category: "phi_inventory",
      action,
      actor: actorName,
      resource: systemName,
      severity: "info",
      message: `PHI inventory ${action} on ${systemName}.${row.change_reason ? ` ${row.change_reason}` : ""}`.trim(),
      metadata: {
        system_id: row.system_id,
        change_reason: row.change_reason,
        previous_values: row.previous_values ?? null,
        next_values: row.next_values ?? null,
      },
    };
  });

  return [...roleEvents, ...phiEvents];
}

async function fetchSupabasePlatformLogs(filters: AuditEventFilters): Promise<AuditEventRow[]> {
  if (!env.supabaseProjectRef || !env.supabaseAccessToken) {
    throw new Error("Supabase platform log credentials are not configured.");
  }

  const searchParams = new URLSearchParams();
  const endDate = parseDate(filters.to) ?? new Date();
  const startDate = parseDate(filters.since) ?? parseDate(filters.from) ?? new Date(Date.now() - 60_000);
  const normalizedStart = startDate.toISOString();
  const normalizedEnd = endDate.toISOString();
  searchParams.set("iso_timestamp_start", normalizedStart);
  searchParams.set("iso_timestamp_end", normalizedEnd);

  const url = `https://api.supabase.com/v1/projects/${env.supabaseProjectRef}/analytics/endpoints/logs.all?${searchParams.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.supabaseAccessToken}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Supabase logs fetch failed (${response.status}). ${body}`.trim());
    }

    const payload = (await response.json()) as { logs?: unknown[]; result?: unknown[] } | unknown[];
    const rawRows = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { result?: unknown[] }).result)
        ? (payload as { result: unknown[] }).result
      : Array.isArray((payload as { logs?: unknown[] }).logs)
        ? (payload as { logs: unknown[] }).logs
        : [];

    return rawRows.map((entry, index) => {
      const row = entry as Record<string, unknown>;
      const timestampValue = row.timestamp ?? row.time ?? row.created_at ?? new Date().toISOString();
      const timestamp =
        typeof timestampValue === "string" && timestampValue.length > 0
          ? timestampValue
          : new Date().toISOString();
      const idValue = row.id ?? row.event_message_id ?? `${timestamp}-${index}`;
      const severity = normalizeSeverity(
        typeof row.severity === "string"
          ? row.severity
          : typeof row.level === "string"
            ? row.level
            : "info",
      );
      const category =
        typeof row.service === "string"
          ? row.service
          : typeof row.source === "string"
            ? row.source
            : "supabase";
      const action =
        typeof row.event_message === "string"
          ? row.event_message
          : typeof row.type === "string"
            ? row.type
            : "log";
      const actor =
        typeof row.actor === "string"
          ? row.actor
          : typeof row.user_email === "string"
            ? row.user_email
            : null;
      const resource =
        typeof row.path === "string"
          ? row.path
          : typeof row.project_ref === "string"
            ? row.project_ref
            : null;
      const message =
        typeof row.message === "string"
          ? row.message
          : typeof row.event_message === "string"
            ? row.event_message
            : "Supabase platform log event";

      return {
        id: `platform:${String(idValue)}`,
        timestamp,
        source: "platform",
        category,
        action,
        actor,
        resource,
        severity,
        message,
        metadata: row,
      } satisfies AuditEventRow;
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function persistAuditEvents(
  context: AuthContext,
  organizationId: string,
  rows: AuditEventRow[],
): Promise<void> {
  if (rows.length === 0) return;

  const payload: Array<PersistedAuditEventRow & { organization_id: string }> = rows.map((row) => ({
    organization_id: organizationId,
    event_uid: `${row.source}:${row.id}`,
    source: row.source,
    category: row.category,
    action: row.action,
    actor: row.actor,
    resource: row.resource,
    severity: row.severity,
    message: row.message,
    metadata: row.metadata ?? {},
    timestamp: row.timestamp,
  }));

  const { error } = await context.supabase
    .from("audit_event_stream")
    .upsert(payload, { onConflict: "organization_id,event_uid" });

  if (error) {
    throw new HttpError(500, "audit_events_persist_failed", error.message);
  }
}

async function listPersistedAuditEvents(
  context: AuthContext,
  organizationId: string,
  filters: AuditEventFilters,
  page: number,
  limit: number,
): Promise<{ rows: AuditEventRow[]; total: number }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = context.supabase
    .from("audit_event_stream")
    .select(
      "event_uid, source, category, action, actor, resource, severity, message, metadata, timestamp",
      { count: "exact" },
    )
    .eq("organization_id", organizationId);

  if (filters.source && filters.source !== "all") query = query.eq("source", filters.source);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.module) query = query.eq("category", filters.module);
  if (filters.actor) query = query.ilike("actor", `%${filters.actor}%`);
  if (filters.action) query = query.ilike("action", `%${filters.action}%`);
  if (filters.from) query = query.gte("timestamp", filters.from);
  if (filters.to) query = query.lte("timestamp", filters.to);
  if (filters.since) query = query.gt("timestamp", filters.since);
  if (filters.search) {
    const safe = filters.search.replaceAll(",", " ").replaceAll("%", "");
    query = query.or(
      `message.ilike.%${safe}%,action.ilike.%${safe}%,resource.ilike.%${safe}%,actor.ilike.%${safe}%`,
    );
  }

  const { data, error, count } = await query
    .order("timestamp", { ascending: false })
    .range(from, to);

  if (error) throw new HttpError(500, "audit_events_query_failed", error.message);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.event_uid),
    timestamp: String(row.timestamp),
    source: row.source as AuditEventSource,
    category: String(row.category),
    action: String(row.action),
    actor: typeof row.actor === "string" ? row.actor : null,
    resource: typeof row.resource === "string" ? row.resource : null,
    severity: row.severity as AuditEventSeverity,
    message: String(row.message),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }));

  return { rows, total: count ?? 0 };
}

export async function listAuditEvents(
  context: AuthContext,
  filters: AuditEventFilters,
): Promise<AuditEventsResponse> {
  const actor = await requirePermission(context, "audit_log_viewer", "read_only");
  const source = filters.source ?? "all";
  const page = Number.isFinite(filters.page) ? Math.max(1, filters.page ?? 1) : 1;
  const limit = Number.isFinite(filters.limit) ? Math.min(200, Math.max(1, filters.limit ?? 50)) : 50;
  const partialSourceErrors: string[] = [];

  const tasks: Array<Promise<AuditEventRow[]>> = [];
  if (source === "all" || source === "app") {
    tasks.push(listAppAuditEvents(context, actor.organization_id));
  }
  if (source === "all" || source === "platform") {
    tasks.push(
      fetchSupabasePlatformLogs(filters).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to load Supabase platform logs.";
        partialSourceErrors.push(message);
        return [];
      }),
    );
  }

  const results = await Promise.all(tasks);
  const merged = results
    .flat()
    .filter((row) => includeEvent(row, filters))
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

  try {
    await persistAuditEvents(context, actor.organization_id, merged);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to persist audit events.";
    partialSourceErrors.push(message);
  }

  const persisted = await listPersistedAuditEvents(context, actor.organization_id, filters, page, limit);
  const nextSince = persisted.rows.length > 0 ? persisted.rows[0]?.timestamp ?? null : filters.since ?? null;

  return {
    rows: persisted.rows,
    page,
    limit,
    total: persisted.total,
    next_since: nextSince,
    partial_source_errors: partialSourceErrors,
  };
}
