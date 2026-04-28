"use client";

import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type {
  PhiBulkUpdateResult,
  PhiInventoryCoverageRow,
  PhiInventoryListResponse,
  PhiInventoryRiskSummary,
  PhiSystem,
} from "@/lib/api/types";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { PhiInventoryAlertBanner } from "@/components/phi-inventory/alert-banner";
import { OwnerCell, RetentionCell } from "@/components/phi-inventory/cells";
import { SystemDetailPanel } from "@/components/phi-inventory/system-detail-panel";
import { SystemSlideOver } from "@/components/phi-inventory/system-slide-over";
import {
  ClassificationBadge,
  RiskScoreBadge,
  SystemStatusBadge,
  SystemTypeIcon,
} from "@/components/phi-inventory/tags-and-badges";

function buildListQuery(params: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    u.set(k, String(v));
  }
  const qs = u.toString();
  return qs ? `?${qs}` : "";
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-hs-card border border-hs-border bg-hs-card p-5">
      <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{value}</p>
    </div>
  );
}

export default function PhiInventoryPage() {
  const [list, setList] = useState<PhiInventoryListResponse | null>(null);
  const [coverage, setCoverage] = useState<PhiInventoryCoverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskSummary, setRiskSummary] = useState<PhiInventoryRiskSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [classification, setClassification] = useState("all");
  const [department, setDepartment] = useState("all");
  const [retentionStatus, setRetentionStatus] = useState("all");
  const [ownerStatus, setOwnerStatus] = useState("all");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [selected, setSelected] = useState<PhiSystem | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);
  const [slideMode, setSlideMode] = useState<"create" | "edit">("create");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState("business_owner_id");
  const [bulkValue, setBulkValue] = useState("");

  const loadData = useCallback(async () => {
    setError(null);
    const listQs = buildListQuery({
      page,
      limit: 20,
      search: search.trim() || undefined,
      classification: classification === "all" ? undefined : classification,
      department: department === "all" ? undefined : department,
      retention_status: retentionStatus === "all" ? undefined : retentionStatus,
      owner_status: ownerStatus === "all" ? undefined : ownerStatus,
      status: status === "all" ? undefined : status,
      source: source === "all" ? undefined : source,
    });
    const [listRes, covRes, riskRes] = await Promise.all([
      apiFetch(`/api/phi-inventory${listQs}`),
      apiFetch("/api/phi-inventory/coverage"),
      apiFetch("/api/phi-inventory/risk-summary"),
    ]);
    const listJson = (await listRes.json()) as PhiInventoryListResponse & { message?: string };
    const covJson = (await covRes.json()) as PhiInventoryCoverageRow[] | { message?: string };
    if (!listRes.ok) {
      setError(typeof listJson?.message === "string" ? listJson.message : "Failed to load inventory.");
      setList(null);
      return;
    }
    setList(listJson);
    if (covRes.ok && Array.isArray(covJson)) {
      setCoverage(covJson);
    } else {
      setCoverage([]);
    }
    if (riskRes.ok) {
      const riskJson = (await riskRes.json()) as PhiInventoryRiskSummary;
      setRiskSummary(riskJson);
    } else {
      setRiskSummary(null);
    }
    setSelected((prev) => {
      if (!prev) return null;
      const hit = listJson.items?.find((i) => i.id === prev.id);
      return hit ?? prev;
    });
  }, [page, search, classification, department, retentionStatus, ownerStatus, status, source]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await loadData();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const totalPages = useMemo(() => {
    if (!list) return 1;
    return Math.max(1, Math.ceil(list.total / 20));
  }, [list]);

  function openCreate() {
    setSlideMode("create");
    setSlideOpen(true);
  }

  function openEdit(s: PhiSystem) {
    setSelected(s);
    setSlideMode("edit");
    setSlideOpen(true);
  }

  async function applyBulk() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const updates: Record<string, unknown> = {};
    updates[bulkField] = bulkValue || null;
    const res = await apiFetch("/api/phi-inventory/bulk", {
      method: "PATCH",
      body: JSON.stringify({ ids, updates }),
    });
    const json = (await res.json()) as PhiBulkUpdateResult;
    if (!res.ok) {
      setError("Bulk update failed.");
      return;
    }
    if (json.errors.length > 0) {
      setError(`Bulk partially applied. ${json.updated} updated, ${json.errors.length} failed.`);
    }
    setSelectedIds(new Set());
    await loadData();
  }

  async function exportAuditPackage() {
    const res = await apiFetch("/api/phi-inventory/export/audit-package", {
      method: "POST",
      body: JSON.stringify({ include_decommissioned: status === "decommissioned" || status === "all" }),
    });
    if (!res.ok) {
      setError("Failed to export audit package.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto min-w-0 max-w-[1240px] space-y-8">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-hs-title font-semibold text-hs-text">PHI inventory</h1>
            <p className="mt-2 max-w-2xl text-hs-body text-hs-muted">
              Human-verified catalog of systems that create, receive, maintain, or transmit PHI. Row actions open the detail panel; edit uses the
              slide-over form.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <HsSecondaryButton type="button" onClick={() => void exportAuditPackage()}>
              Export audit package
            </HsSecondaryButton>
            <HsPrimaryButton type="button" onClick={openCreate}>
              Add system
            </HsPrimaryButton>
          </div>
        </section>

        {error ? (
          <div className="border-l-4 border-hs-danger bg-hs-danger-bg px-6 py-4 text-hs-body text-hs-text">
            <span className="font-medium text-hs-danger">Error:</span> {error}
          </div>
        ) : null}

        {list ? (
          <PhiInventoryAlertBanner
            missingOwners={list.stats.missingOwners}
            retentionGaps={list.stats.retentionGaps}
            reviewOverdue={list.stats.reviewOverdue}
          />
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading || !list ? (
            Array.from({ length: 4 }).map((_, i) => <HsSkeleton key={i} className="h-[118px] w-full" />)
          ) : (
            <>
              <MetricCard label="Systems cataloged" value={String(list.stats.systemsCataloged)} />
              <MetricCard label="Missing owners" value={String(list.stats.missingOwners)} />
              <MetricCard label="Retention gaps" value={String(list.stats.retentionGaps)} />
              <MetricCard label="Reviews due / overdue" value={String(list.stats.reviewOverdue)} />
            </>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Critical risk systems" value={String(riskSummary?.critical ?? 0)} />
          <MetricCard label="High risk systems" value={String(riskSummary?.high ?? 0)} />
          <MetricCard label="Medium risk systems" value={String(riskSummary?.medium ?? 0)} />
          <MetricCard label="Low risk systems" value={String(riskSummary?.low ?? 0)} />
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <h2 className="text-hs-section font-semibold text-hs-text">Filters</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HsTextInput
              label="Search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Name, department, notes"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearch(searchDraft);
                  setPage(1);
                }
              }}
            />
            <HsSelect label="Classification" value={classification} onChange={(e) => { setClassification(e.target.value); setPage(1); }}>
              <option value="all">All</option>
              <option value="clinical">Clinical</option>
              <option value="direct_identifier">Direct identifier</option>
              <option value="financial">Financial</option>
              <option value="contact">Contact</option>
              <option value="derived">Derived</option>
            </HsSelect>
            <HsSelect label="Department" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
              <option value="all">All</option>
              {(list?.departments ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </HsSelect>
            <HsSelect label="Retention" value={retentionStatus} onChange={(e) => { setRetentionStatus(e.target.value); setPage(1); }}>
              <option value="all">All</option>
              <option value="policy_set">Policy set</option>
              <option value="missing_policy">Missing policy</option>
            </HsSelect>
            <HsSelect label="Owners" value={ownerStatus} onChange={(e) => { setOwnerStatus(e.target.value); setPage(1); }}>
              <option value="all">All</option>
              <option value="missing_owner">Missing owner</option>
              <option value="owner_assigned">Both assigned</option>
            </HsSelect>
            <HsSelect label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="all">Active catalog</option>
              <option value="active">Active</option>
              <option value="needs_review">Needs review</option>
              <option value="at_risk">At risk</option>
              <option value="decommissioned">Decommissioned</option>
            </HsSelect>
            <HsSelect label="Source" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
              <option value="all">All</option>
              <option value="manual">Manual</option>
              <option value="scanner">Scanner</option>
            </HsSelect>
            <div className="flex items-end">
              <HsSecondaryButton
                type="button"
                className="w-full sm:w-auto"
                onClick={() => {
                  setSearch(searchDraft);
                  setPage(1);
                }}
              >
                Apply search
              </HsSecondaryButton>
            </div>
          </div>
        </section>

        {selected ? (
          <SystemDetailPanel
            system={selected}
            onEdit={() => openEdit(selected)}
            onDecommissioned={() => {
              setSelected(null);
              void loadData();
            }}
            onReviewSubmitted={() => void loadData()}
          />
        ) : null}

        <div className="space-y-8">
          <section className="min-w-0 w-full rounded-hs-card border border-hs-border bg-hs-card p-6">
            <h2 className="text-hs-section font-semibold text-hs-text">Systems</h2>
            {selectedIds.size > 0 ? (
              <div className="mt-4 rounded-hs border border-hs-primary/40 bg-hs-info-bg p-3">
                <p className="text-hs-caption text-hs-text">{selectedIds.size} selected</p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <HsSelect label="Bulk field" value={bulkField} onChange={(e) => setBulkField(e.target.value)}>
                    <option value="business_owner_id">Assign business owner (user ID)</option>
                    <option value="technical_owner_id">Assign technical owner (user ID)</option>
                    <option value="retention_years">Set retention years</option>
                    <option value="review_cadence">Set review cadence</option>
                    <option value="classification">Set classification</option>
                  </HsSelect>
                  <HsTextInput label="Value" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
                  <HsSecondaryButton type="button" onClick={() => void applyBulk()}>
                    Apply to selected
                  </HsSecondaryButton>
                </div>
              </div>
            ) : null}
            {loading ? (
              <div className="mt-5 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <HsSkeleton key={i} className="h-[52px] w-full" rounded="none" />
                ))}
              </div>
            ) : !list || list.items.length === 0 ? (
              <div className="mt-5">
                <HsEmptyState
                  title="No systems yet"
                  description="Add a system from the catalog or run the PHI Leakage Scanner to discover sources."
                />
              </div>
            ) : (
              <div className="mt-5 min-w-0 overflow-x-auto rounded-hs border border-hs-border">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead className="border-b border-hs-fill bg-hs-page">
                    <tr>
                      {["", "System", "Type", "Class", "Status", "Risk", "Owners", "Retention", "Review"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((row) => (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-b border-hs-fill hover:bg-hs-fill-hover ${
                          selected?.id === row.id ? "bg-hs-info-bg/40" : ""
                        }`}
                        onClick={() => setSelected(row)}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.id)) next.delete(row.id);
                                else next.add(row.id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-start gap-2">
                            <SystemTypeIcon systemType={row.system_type} />
                            <div className="min-w-0">
                              <p className="font-medium text-hs-text">{row.name}</p>
                              <p className="text-[11px] text-hs-muted">{row.department}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-hs-caption capitalize text-hs-secondary">{row.system_type.replace(/_/g, " ")}</td>
                        <td className="px-3 py-2.5">
                          <ClassificationBadge classification={row.classification} />
                        </td>
                        <td className="px-3 py-2.5">
                          <SystemStatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2.5">
                          <RiskScoreBadge score={Number(row.risk_score ?? 0)} />
                        </td>
                        <td className="max-w-[200px] px-3 py-2.5">
                          <OwnerCell system={row} onAssign={() => openEdit(row)} />
                        </td>
                        <td className="px-3 py-2.5">
                          <RetentionCell system={row} />
                        </td>
                        <td className="px-3 py-2.5 text-hs-caption text-hs-secondary">
                          {row.next_review_due_at ? (
                            <>
                              {new Date(row.next_review_due_at).toLocaleDateString()}
                              <br />
                              <span className="text-hs-muted">
                                {formatDistanceToNow(new Date(row.next_review_due_at), { addSuffix: true })}
                              </span>
                            </>
                          ) : (
                            <span className="text-hs-muted">Not set</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {list && list.total > 20 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-hs-caption text-hs-muted">
                <span>
                  Page {page} of {totalPages} · {list.total} systems
                </span>
                <div className="flex gap-2">
                  <HsSecondaryButton
                    type="button"
                    onClick={() => {
                      const ids = list.items.map((row) => row.id);
                      setSelectedIds(new Set(ids));
                    }}
                  >
                    Select page
                  </HsSecondaryButton>
                  <HsSecondaryButton type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </HsSecondaryButton>
                  <HsSecondaryButton type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </HsSecondaryButton>
                </div>
              </div>
            ) : null}
          </section>

          <section className="w-full rounded-hs-card border border-hs-border bg-hs-card p-6">
            <h2 className="text-hs-section font-semibold text-hs-text">Coverage map</h2>
            <p className="mt-1 text-hs-caption text-hs-muted">PHI types across active systems (non-decommissioned).</p>
            {coverage.length === 0 ? (
              <p className="mt-4 text-hs-caption text-hs-muted">No PHI types tagged yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {coverage.map((c) => (
                  <li key={c.phi_type} className="rounded-hs border border-hs-border bg-hs-page/50 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium capitalize text-hs-text">{c.phi_type.replace(/_/g, " ")}</span>
                      <span className="tabular-nums text-hs-caption text-hs-muted">{c.system_count}</span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-[11px] text-hs-secondary">
                      {c.systems.map((s) => s.name).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <SystemSlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        mode={slideMode}
        system={slideMode === "edit" ? selected : null}
        onSaved={() => void loadData()}
      />
    </div>
  );
}
