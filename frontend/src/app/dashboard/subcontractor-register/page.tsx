"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createSubcontractor,
  getSubcontractors,
  patchSubcontractor,
  type SubcontractorRow,
} from "@/lib/api/subcontractors";
import { getBaaVendors, type BaaVendor } from "@/lib/api/vendors";
import { useDashboardRbac } from "@/lib/rbac/context";
import { HsAlertBanner } from "@/components/hipaa-shield/HsAlertBanner";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import { HsModal } from "@/components/hipaa-shield/HsModal";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsReadOnlyBanner } from "@/components/hipaa-shield/HsReadOnlyBanner";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { cn } from "@/lib/utils";

const statusOptions: SubcontractorRow["baa_status"][] = ["PASS", "WARNING", "FAIL", "PENDING"];

const statusStyles: Record<SubcontractorRow["baa_status"], string> = {
  PASS: "border-hs-success-border bg-hs-success-bg text-hs-success",
  WARNING: "border-[#FDE68A] bg-hs-warning-bg text-hs-warning",
  FAIL: "border-hs-danger-border bg-hs-danger-bg text-hs-danger",
  PENDING: "border-hs-border bg-hs-fill text-hs-muted",
};

function friendlyError(message: string) {
  if (message === "Failed to fetch" || message.toLowerCase().includes("fetch")) {
    return "Data unavailable: start the backend API on port 4000 and refresh.";
  }
  return message;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function withinLastDays(iso: string, days: number) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * 86400000;
}

export default function SubcontractorRegisterPage() {
  const rbac = useDashboardRbac();
  const canWrite = rbac.canWritePage("subcontractor_register");
  const readOnly = rbac.permissionFor("subcontractor_register") === "read_only";

  const [rows, setRows] = useState<SubcontractorRow[]>([]);
  const [vendors, setVendors] = useState<BaaVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addVendorId, setAddVendorId] = useState("");
  const [addName, setAddName] = useState("");
  const [addStatus, setAddStatus] = useState<SubcontractorRow["baa_status"]>("PENDING");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editRow, setEditRow] = useState<SubcontractorRow | null>(null);
  const [editVendorId, setEditVendorId] = useState("");
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<SubcontractorRow["baa_status"]>("PENDING");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, vlist] = await Promise.all([getSubcontractors(), getBaaVendors().catch(() => [])]);
      setRows(list);
      setVendors(vlist);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Failed to load subcontractors."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.parent_vendor_name.toLowerCase().includes(q) ||
        (r.parent_covered_services ?? "").toLowerCase().includes(q) ||
        r.baa_status.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const missing = rows.filter((r) => r.baa_status === "FAIL").length;
    const pending = rows.filter((r) => r.baa_status === "PENDING").length;
    const pass = rows.filter((r) => r.baa_status === "PASS").length;
    const passRecent = rows.filter((r) => r.baa_status === "PASS" && withinLastDays(r.created_at, 90)).length;
    return { total, missing, pending, pass, passRecent };
  }, [rows]);

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!addVendorId) {
      setError("Select a parent vendor.");
      return;
    }
    if (!addName.trim()) {
      setError("Subcontractor name is required.");
      return;
    }
    try {
      setAddSubmitting(true);
      await createSubcontractor({ vendor_id: addVendorId, name: addName.trim(), baa_status: addStatus });
      setAddOpen(false);
      setAddVendorId("");
      setAddName("");
      setAddStatus("PENDING");
      setSuccess("Subcontractor registered.");
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Create failed."));
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    setError(null);
    setSuccess(null);
    if (!editName.trim()) {
      setError("Name is required.");
      return;
    }
    if (!editVendorId) {
      setError("Parent vendor is required.");
      return;
    }
    try {
      setEditSubmitting(true);
      await patchSubcontractor(editRow.id, {
        vendor_id: editVendorId,
        name: editName.trim(),
        baa_status: editStatus,
      });
      setEditRow(null);
      setSuccess("Subcontractor updated.");
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Update failed."));
    } finally {
      setEditSubmitting(false);
    }
  }

  function openEdit(row: SubcontractorRow) {
    setEditRow(row);
    setEditVendorId(row.vendor_id);
    setEditName(row.name);
    setEditStatus(row.baa_status);
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1280px] space-y-6">
        {readOnly ? <HsReadOnlyBanner /> : null}
        {error ? (
          <HsAlertBanner variant="WARNING" onDismiss={() => setError(null)}>
            <span className="font-medium">Subcontractor register:</span> {error}
          </HsAlertBanner>
        ) : null}
        {success ? (
          <HsAlertBanner variant="INFO" onDismiss={() => setSuccess(null)}>
            {success}
          </HsAlertBanner>
        ) : null}

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-hs-caption font-semibold uppercase tracking-[0.1em] text-hs-primary">
                Vendors & Partners
              </p>
              <h1 className="mt-2 text-hs-title font-semibold text-hs-text">Subcontractor register</h1>
              <p className="mt-2 max-w-2xl text-hs-body text-hs-muted">
                Sub-BA organizations linked to your{" "}
                <Link href="/dashboard/baa-tracker" className="font-medium text-hs-primary underline">
                  BAA vendors
                </Link>
                . Track sub-BAA posture, evidence gaps, and parent coverage in one place.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-3 py-1 text-hs-caption font-medium text-hs-muted">
                  Privacy Officer
                </span>
                <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-3 py-1 text-hs-caption font-medium text-hs-muted">
                  Compliance Manager
                </span>
                <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-3 py-1 text-hs-caption font-medium text-hs-muted">
                  Security Officer
                </span>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
              <HsTextInput
                label="Search"
                placeholder="Subcontractor, parent vendor, services…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 sm:min-w-[240px] sm:flex-1 lg:w-72"
              />
              <div className="flex gap-3">
                <HsSecondaryButton type="button" onClick={() => void load()} disabled={loading}>
                  Refresh
                </HsSecondaryButton>
                {canWrite ? (
                  <HsPrimaryButton type="button" onClick={() => setAddOpen(true)} disabled={loading}>
                    Add subcontractor
                  </HsPrimaryButton>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <HsSkeleton key={i} className="h-28 rounded-hs-card" />
            ))}
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-4">
            <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Sub-BAs</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{stats.total}</p>
              <p className="mt-1 text-sm text-hs-muted">Registered under your vendors</p>
            </article>
            <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Missing evidence</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-danger">{stats.missing}</p>
              <p className="mt-1 text-sm text-hs-muted">Sub-BAA status FAIL — request evidence</p>
            </article>
            <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Pending review</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-warning">{stats.pending}</p>
              <p className="mt-1 text-sm text-hs-muted">Awaiting sub-BAA decision</p>
            </article>
            <article className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Passing</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-success">{stats.pass}</p>
              <p className="mt-1 text-sm text-hs-muted">
                Sub-BAA PASS · <span className="font-medium text-hs-text">{stats.passRecent}</span> added in last 90 days
              </p>
            </article>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
            <div className="mb-4 flex flex-col gap-2 border-b border-hs-fill pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-hs-section font-semibold text-hs-text">Coverage register</h2>
                <p className="text-sm text-hs-muted">
                  {loading ? "Loading…" : `${filtered.length} of ${rows.length} shown`}
                </p>
              </div>
              <Link href="/dashboard/vendor-risk-scores" className="text-sm font-medium text-hs-primary underline">
                Vendor risk scores
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <HsSkeleton key={i} className="h-14 rounded-hs" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <HsEmptyState
                title={rows.length === 0 ? "No subcontractors" : "No matches"}
                description={
                  rows.length === 0
                    ? "Register subcontractors used by your business associates. Add one to link a sub-BA to a parent vendor."
                    : "Try a different search term."
                }
                actionLabel={rows.length === 0 && canWrite ? "Add subcontractor" : undefined}
                onAction={rows.length === 0 && canWrite ? () => setAddOpen(true) : undefined}
              />
            ) : (
              <div className="overflow-x-auto rounded-hs border border-hs-border">
                <table className="w-full min-w-[880px] border-collapse text-left">
                  <thead>
                    <tr className="h-11 bg-hs-page text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                      <th className="px-4 py-3">Subcontractor</th>
                      <th className="px-4 py-3">Parent vendor</th>
                      <th className="px-4 py-3">Covered services (parent)</th>
                      <th className="px-4 py-3">Sub-BAA</th>
                      <th className="px-4 py-3">Added</th>
                      {canWrite ? <th className="px-4 py-3 w-[100px]">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.id} className="border-t border-hs-fill transition-colors hover:bg-hs-page/80">
                        <td className="px-4 py-3 text-sm font-medium text-hs-text">{row.name}</td>
                        <td className="px-4 py-3 text-sm text-hs-text">{row.parent_vendor_name}</td>
                        <td className="px-4 py-3 text-sm text-hs-muted">{row.parent_covered_services ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium",
                              statusStyles[row.baa_status],
                            )}
                          >
                            {row.baa_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-hs-muted">{formatDate(row.created_at)}</td>
                        {canWrite ? (
                          <td className="px-4 py-3">
                            <HsSecondaryButton type="button" onClick={() => openEdit(row)}>
                              Edit
                            </HsSecondaryButton>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-hs-card border border-hs-border bg-hs-card p-5">
              <h3 className="text-sm font-semibold text-hs-text">Operational workflow</h3>
              <ol className="mt-4 space-y-3 text-sm text-hs-muted">
                {[
                  "Add subcontractor and link to parent BA.",
                  "Set sub-BAA status as evidence arrives.",
                  "Request missing artifacts from the vendor.",
                  "Re-run vendor risk scoring after updates.",
                ].map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-hs-primary/10 text-hs-caption font-semibold text-hs-primary">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-hs-card border border-hs-warning/40 bg-hs-warning-bg/50 p-4 text-sm text-hs-text">
              <p className="font-medium text-hs-text">States covered</p>
              <p className="mt-2 text-hs-muted">
                Loading uses page-level skeletons. Errors are retryable — fix the issue, then use{" "}
                <span className="font-medium text-hs-text">Refresh</span>. Empty state appears when no rows exist for
                your organization.
              </p>
            </div>
          </aside>
        </section>
      </div>

      <HsModal
        open={addOpen}
        onClose={() => {
          if (addSubmitting) return;
          setAddOpen(false);
        }}
        title="Add subcontractor"
        footer={
          <>
            <HsSecondaryButton type="button" disabled={addSubmitting} onClick={() => setAddOpen(false)}>
              Cancel
            </HsSecondaryButton>
            <HsPrimaryButton type="submit" form="add-sub-form" loading={addSubmitting}>
              Save
            </HsPrimaryButton>
          </>
        }
      >
        <form id="add-sub-form" className="grid gap-4" onSubmit={handleAddSubmit}>
          <HsSelect
            label="Parent vendor"
            name="vendor_id"
            value={addVendorId}
            onChange={(e) => setAddVendorId(e.target.value)}
            required
          >
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </HsSelect>
          <HsTextInput label="Subcontractor name" name="name" value={addName} onChange={(e) => setAddName(e.target.value)} required />
          <HsSelect label="Sub-BAA status" name="baa_status" value={addStatus} onChange={(e) => setAddStatus(e.target.value as SubcontractorRow["baa_status"])}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </HsSelect>
        </form>
      </HsModal>

      <HsModal
        open={Boolean(editRow)}
        onClose={() => {
          if (editSubmitting) return;
          setEditRow(null);
        }}
        title={editRow ? `Edit ${editRow.name}` : "Edit"}
        footer={
          <>
            <HsSecondaryButton type="button" disabled={editSubmitting} onClick={() => setEditRow(null)}>
              Cancel
            </HsSecondaryButton>
            <HsPrimaryButton type="submit" form="edit-sub-form" loading={editSubmitting}>
              Save changes
            </HsPrimaryButton>
          </>
        }
      >
        <form id="edit-sub-form" className="grid gap-4" onSubmit={handleEditSubmit}>
          <HsSelect
            label="Parent vendor"
            name="edit_vendor_id"
            value={editVendorId}
            onChange={(e) => setEditVendorId(e.target.value)}
            required
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </HsSelect>
          <HsTextInput label="Subcontractor name" name="edit_name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <HsSelect label="Sub-BAA status" name="edit_baa_status" value={editStatus} onChange={(e) => setEditStatus(e.target.value as SubcontractorRow["baa_status"])}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </HsSelect>
        </form>
      </HsModal>
    </div>
  );
}
