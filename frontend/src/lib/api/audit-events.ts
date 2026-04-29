import { apiFetch } from "@/lib/api/client";

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

export type AuditEventsResponse = {
  rows: AuditEventRow[];
  page: number;
  limit: number;
  total: number;
  next_since: string | null;
  partial_source_errors: string[];
};

export type AuditEventFilters = {
  source?: "app" | "platform" | "all";
  severity?: AuditEventSeverity | "all";
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

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed");
  }
  return data as T;
}

export async function getAuditEvents(filters: AuditEventFilters = {}) {
  const params = new URLSearchParams();
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.severity && filters.severity !== "all") params.set("severity", filters.severity);
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.module) params.set("module", filters.module);
  if (filters.action) params.set("action", filters.action);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.since) params.set("since", filters.since);
  if (typeof filters.page === "number") params.set("page", String(filters.page));
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));

  const query = params.toString();
  return readJson<AuditEventsResponse>(await apiFetch(`/api/audit/events${query ? `?${query}` : ""}`));
}
