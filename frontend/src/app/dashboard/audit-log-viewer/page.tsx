"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, RefreshCcw } from "lucide-react";
import {
  getAuditEvents,
  type AuditEventFilters,
  type AuditEventRow,
  type AuditEventSeverity,
} from "@/lib/api/audit-events";
import { useDashboardRbac } from "@/lib/rbac/context";
import { HsAlertBanner } from "@/components/hipaa-shield/HsAlertBanner";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import { HsReadOnlyBanner } from "@/components/hipaa-shield/HsReadOnlyBanner";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_SECONDS = 10;
const PAGE_LIMIT = 50;

const severityStyles: Record<AuditEventSeverity, string> = {
  critical: "border-hs-danger-border bg-hs-danger-bg text-hs-danger",
  high: "border-[#FDE68A] bg-hs-warning-bg text-hs-warning",
  medium: "border-hs-border bg-hs-fill text-hs-muted",
  low: "border-hs-border bg-hs-fill text-hs-muted",
  info: "border-hs-info-border bg-hs-info-bg text-hs-info",
};

function friendlyError(message: string) {
  if (message === "Failed to fetch" || message.toLowerCase().includes("fetch")) {
    return "Audit logs are unavailable because the backend API is not reachable. Start backend on port 4000 and refresh.";
  }
  return message;
}

function timeAgo(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function mergeDedupe(current: AuditEventRow[], incoming: AuditEventRow[]) {
  const map = new Map<string, AuditEventRow>();
  for (const row of [...incoming, ...current]) {
    map.set(`${row.source}:${row.id}`, row);
  }
  return [...map.values()].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

function toDatetimeLocalValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function AuditLogViewerPage() {
  const rbac = useDashboardRbac();
  const [rows, setRows] = useState<AuditEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [secondsToRefresh, setSecondsToRefresh] = useState(POLL_INTERVAL_SECONDS);
  const [source, setSource] = useState<"all" | "app" | "platform">("all");
  const [severity, setSeverity] = useState<"all" | AuditEventSeverity>("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "terminal">("terminal");
  const sinceRef = useRef<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const moduleOptions = useMemo(() => {
    const values = [...new Set(rows.map((row) => row.category).filter(Boolean))].sort();
    return ["all", ...values];
  }, [rows]);

  const baseFilters: AuditEventFilters = useMemo(
    () => ({
      source,
      severity,
      module: moduleFilter !== "all" ? moduleFilter : undefined,
      search: search.trim() || undefined,
      actor: actor.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [actor, from, moduleFilter, search, severity, source, to],
  );

  const loadHistory = useCallback(async (targetPage = page) => {
    setError(null);
    setLoading(true);
    try {
      const response = await getAuditEvents({
        ...baseFilters,
        page: targetPage,
        limit: PAGE_LIMIT,
      });
      setRows(response.rows);
      setTotal(response.total);
      setPartialErrors(response.partial_source_errors ?? []);
      sinceRef.current = response.next_since ?? response.rows[0]?.timestamp ?? null;
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Failed to load audit logs."));
      setRows([]);
      setTotal(0);
      setPartialErrors([]);
      sinceRef.current = null;
    } finally {
      setLoading(false);
      setSecondsToRefresh(POLL_INTERVAL_SECONDS);
    }
  }, [baseFilters, page]);

  async function refreshNow() {
    setRefreshing(true);
    await loadHistory(1);
    setPage(1);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadHistory(page);
  }, [loadHistory, page]);

  useEffect(() => {
    if (page !== 1) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      setSecondsToRefresh((value) => (value <= 1 ? POLL_INTERVAL_SECONDS : value - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [page]);

  useEffect(() => {
    if (page !== 1) return;
    const poll = setInterval(async () => {
      if (document.hidden || !sinceRef.current) return;
      try {
        const response = await getAuditEvents({
          ...baseFilters,
          since: sinceRef.current,
          page: 1,
          limit: PAGE_LIMIT,
        });
        if (response.rows.length > 0) {
          setRows((current) => mergeDedupe(current, response.rows).slice(0, 200));
          sinceRef.current = response.next_since ?? response.rows[0]?.timestamp ?? sinceRef.current;
          setTotal((value) => Math.max(value, value + response.rows.length));
        }
        setPartialErrors(response.partial_source_errors ?? []);
      } catch (err) {
        setPartialErrors([
          `Live refresh failed: ${friendlyError(err instanceof Error ? err.message : "Unknown error")}`,
        ]);
      } finally {
        setSecondsToRefresh(POLL_INTERVAL_SECONDS);
      }
    }, POLL_INTERVAL_SECONDS * 1000);

    return () => clearInterval(poll);
  }, [baseFilters, page]);

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1320px] space-y-6">
        {rbac.permissionFor("audit_log_viewer") === "read_only" ? <HsReadOnlyBanner /> : null}
        {error ? (
          <HsAlertBanner variant="WARNING" onDismiss={() => setError(null)}>
            <span className="font-medium">Audit log issue:</span> {error}
          </HsAlertBanner>
        ) : null}
        {partialErrors.length > 0 ? (
          <HsAlertBanner variant="INFO" onDismiss={() => setPartialErrors([])}>
            <span className="font-medium">Partial source warning:</span> {partialErrors.join(" | ")}
          </HsAlertBanner>
        ) : null}

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-hs-caption font-semibold uppercase tracking-[0.1em] text-hs-primary">
                Security Controls
              </p>
              <h1 className="mt-2 text-hs-title font-semibold text-hs-text">Audit Log Viewer</h1>
              <p className="mt-2 text-hs-body text-hs-muted">
                Unified feed for MedLock application audit events and Supabase platform logs.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <HsSelect
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as "table" | "terminal")}
                className="w-[180px]"
              >
                <option value="terminal">Terminal view</option>
                <option value="table">Table view</option>
              </HsSelect>
              <span className="inline-flex items-center rounded-hs-pill border border-hs-border bg-hs-page px-3 py-1 text-xs text-hs-muted">
                <Clock3 className="mr-1.5 size-3.5" />
                Next refresh in {secondsToRefresh}s
              </span>
              <HsSecondaryButton type="button" onClick={() => void refreshNow()} disabled={loading || refreshing}>
                <RefreshCcw className="mr-2 size-4" />
                {refreshing ? "Refreshing..." : "Refresh"}
              </HsSecondaryButton>
            </div>
          </div>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <HsSecondaryButton
              type="button"
              onClick={() => {
                const end = new Date();
                const start = new Date(Date.now() - 15 * 60 * 1000);
                setFrom(toDatetimeLocalValue(start));
                setTo(toDatetimeLocalValue(end));
                setPage(1);
              }}
            >
              Last 15m
            </HsSecondaryButton>
            <HsSecondaryButton
              type="button"
              onClick={() => {
                const end = new Date();
                const start = new Date(Date.now() - 60 * 60 * 1000);
                setFrom(toDatetimeLocalValue(start));
                setTo(toDatetimeLocalValue(end));
                setPage(1);
              }}
            >
              Last 1h
            </HsSecondaryButton>
            <HsSecondaryButton
              type="button"
              onClick={() => {
                const end = new Date();
                const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
                setFrom(toDatetimeLocalValue(start));
                setTo(toDatetimeLocalValue(end));
                setPage(1);
              }}
            >
              Last 24h
            </HsSecondaryButton>
            <HsSecondaryButton
              type="button"
              onClick={() => {
                const end = new Date();
                const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                setFrom(toDatetimeLocalValue(start));
                setTo(toDatetimeLocalValue(end));
                setPage(1);
              }}
            >
              Last 7d
            </HsSecondaryButton>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <HsSelect value={source} onChange={(event) => setSource(event.target.value as "all" | "app" | "platform")}>
              <option value="all">All sources</option>
              <option value="app">Application only</option>
              <option value="platform">Supabase platform only</option>
            </HsSelect>
            <HsSelect value={severity} onChange={(event) => setSeverity(event.target.value as "all" | AuditEventSeverity)}>
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </HsSelect>
            <HsSelect value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
              {moduleOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All modules" : item}
                </option>
              ))}
            </HsSelect>
            <HsTextInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              label="Search"
              placeholder="Search message/action/resource"
              className="bg-hs-page text-sm"
            />
            <HsTextInput
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              label="Actor"
              placeholder="Filter by actor"
              className="bg-hs-page text-sm"
            />
            <div className="flex w-full flex-col gap-1.5">
              <label className="text-hs-secondary font-medium text-hs-text">From</label>
              <input
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                step={60}
                className="h-10 rounded-hs border border-hs-border bg-hs-page px-3 text-sm text-hs-text outline-none focus:border-hs-primary"
              />
            </div>
            <div className="flex w-full flex-col gap-1.5">
              <label className="text-hs-secondary font-medium text-hs-text">To</label>
              <input
                type="datetime-local"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                step={60}
                className="h-10 rounded-hs border border-hs-border bg-hs-page px-3 text-sm text-hs-text outline-none focus:border-hs-primary"
              />
            </div>
            <HsSecondaryButton
              type="button"
              onClick={() => {
                setSource("all");
                setSeverity("all");
                setModuleFilter("all");
                setSearch("");
                setActor("");
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              Clear filters
            </HsSecondaryButton>
          </div>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-4 md:p-6">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <HsSkeleton key={index} className="h-16 rounded-hs" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <HsEmptyState
              title="No audit logs found"
              description="No events match your current source and filter combination."
            />
          ) : viewMode === "terminal" ? (
            <div className="max-h-[680px] overflow-auto rounded-hs border border-[#1f2937] bg-[#05070c] p-4 font-mono text-xs text-[#d1d5db]">
              <div className="mb-3 flex items-center justify-between text-[11px] text-[#9ca3af]">
                <span>medlock-audit-viewer</span>
                <span>events: {rows.length}</span>
              </div>
              <div className="space-y-2">
                {rows.map((row) => {
                  const key = `${row.source}:${row.id}`;
                  const isOpen = expanded === key;
                  const color =
                    row.severity === "critical"
                      ? "text-[#ef4444]"
                      : row.severity === "high"
                        ? "text-[#f59e0b]"
                        : row.severity === "info"
                          ? "text-[#60a5fa]"
                          : "text-[#d1d5db]";
                  return (
                    <div key={key} className="rounded border border-[#1f2937] bg-[#0b1020] p-2">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : key)}
                        className="w-full text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[#6b7280]">{new Date(row.timestamp).toISOString()}</span>
                          <span className={cn("uppercase", color)}>[{row.severity}]</span>
                          <span className="text-[#93c5fd]">{row.source}</span>
                          <span className="text-[#86efac]">{row.category}</span>
                          <span>{row.action}</span>
                          <span className="text-[#9ca3af]">{row.actor ?? "system"}</span>
                          <span className="truncate text-[#c084fc]">{row.resource ?? "-"}</span>
                        </div>
                        <div className="mt-1 truncate text-[#d1d5db]">{row.message}</div>
                      </button>
                      {isOpen ? (
                        <pre className="mt-2 max-h-64 overflow-auto rounded border border-[#1f2937] bg-[#020617] p-2 text-[11px] text-[#cbd5e1]">
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="h-11 border-b border-hs-fill bg-hs-page">
                    <th className="px-3 text-left text-xs font-semibold uppercase tracking-wide text-hs-muted">When</th>
                    <th className="px-3 text-left text-xs font-semibold uppercase tracking-wide text-hs-muted">Source</th>
                    <th className="px-3 text-left text-xs font-semibold uppercase tracking-wide text-hs-muted">Module</th>
                    <th className="px-3 text-left text-xs font-semibold uppercase tracking-wide text-hs-muted">Action</th>
                    <th className="px-3 text-left text-xs font-semibold uppercase tracking-wide text-hs-muted">Actor</th>
                    <th className="px-3 text-left text-xs font-semibold uppercase tracking-wide text-hs-muted">Severity</th>
                    <th className="px-3 text-left text-xs font-semibold uppercase tracking-wide text-hs-muted">Resource</th>
                    <th className="px-3 text-left text-xs font-semibold uppercase tracking-wide text-hs-muted">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const key = `${row.source}:${row.id}`;
                    const isOpen = expanded === key;
                    return (
                      <Fragment key={key}>
                        <tr className="border-b border-hs-fill hover:bg-hs-page/70">
                          <td className="px-3 py-3 text-sm text-hs-text">
                            <div>{new Date(row.timestamp).toLocaleString()}</div>
                            <div className="text-xs text-hs-muted">{timeAgo(row.timestamp)}</div>
                          </td>
                          <td className="px-3 py-3 text-sm text-hs-text capitalize">{row.source}</td>
                          <td className="px-3 py-3 text-sm text-hs-text">{row.category}</td>
                          <td className="px-3 py-3 text-sm text-hs-text">{row.action}</td>
                          <td className="px-3 py-3 text-sm text-hs-text">{row.actor ?? "System"}</td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                "inline-flex rounded-hs-pill border px-2 py-0.5 text-xs font-medium capitalize",
                                severityStyles[row.severity] ?? severityStyles.info,
                              )}
                            >
                              {row.severity}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-hs-text">{row.resource ?? "-"}</td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpen ? null : key)}
                              className="text-sm font-medium text-hs-primary hover:underline"
                            >
                              {isOpen ? "Hide" : "View"}
                            </button>
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr className="border-b border-hs-fill bg-hs-page/40">
                            <td colSpan={8} className="px-3 py-3">
                              <p className="mb-2 text-sm font-medium text-hs-text">{row.message}</p>
                              <pre className="max-h-72 overflow-auto rounded-hs border border-hs-border bg-hs-card p-3 text-xs text-hs-muted">
                                {JSON.stringify(row.metadata, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex items-center justify-between">
          <p className="text-sm text-hs-muted">
            Showing page {page} of {totalPages} ({total} total events)
          </p>
          <div className="flex gap-2">
            <HsSecondaryButton type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>
              Previous
            </HsSecondaryButton>
            <HsSecondaryButton
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </HsSecondaryButton>
          </div>
        </section>
      </div>
    </div>
  );
}
