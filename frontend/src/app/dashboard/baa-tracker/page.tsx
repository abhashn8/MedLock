"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createBaaVendor,
  getBaaVendors,
  getBaaVendorMouSignedUrl,
  patchBaaVendor,
  uploadBaaVendorMou,
  type BaaVendor,
  type BaaVendorPayload,
} from "@/lib/api/vendors";
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
import { HsTextarea } from "@/components/hipaa-shield/HsTextarea";
import { cn } from "@/lib/utils";

const statusStyles: Record<BaaVendor["baa_status"], string> = {
  PASS: "border-hs-success-border bg-hs-success-bg text-hs-success",
  WARNING: "border-[#FDE68A] bg-hs-warning-bg text-hs-warning",
  FAIL: "border-hs-danger-border bg-hs-danger-bg text-hs-danger",
  PENDING: "border-hs-border bg-hs-fill text-hs-muted",
};

function friendlyError(message: string) {
  if (message === "Failed to fetch" || message.toLowerCase().includes("fetch")) {
    return "Vendor data is unavailable because the backend API is not reachable. Start backend on port 4000 and refresh.";
  }
  return message;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function mouFileLabelFromPath(path: string | null) {
  if (!path) return null;
  const fileName = path.split("/").pop() ?? path;
  return fileName.replace(/^mou-\d+-/, "");
}

const statusOptions: BaaVendor["baa_status"][] = ["PASS", "WARNING", "FAIL", "PENDING"];

type VendorFormState = {
  name: string;
  baa_status: BaaVendor["baa_status"];
  baa_signed_at: string;
  baa_expires_at: string;
  covered_services: string;
  risk_score: string;
};

const initialForm: VendorFormState = {
  name: "",
  baa_status: "PENDING",
  baa_signed_at: "",
  baa_expires_at: "",
  covered_services: "",
  risk_score: "",
};

function formFromVendor(vendor: BaaVendor): VendorFormState {
  return {
    name: vendor.name,
    baa_status: vendor.baa_status,
    baa_signed_at: vendor.baa_signed_at ?? "",
    baa_expires_at: vendor.baa_expires_at ?? "",
    covered_services: vendor.covered_services ?? "",
    risk_score: vendor.risk_score?.toString() ?? "",
  };
}

function normalizePayload(form: VendorFormState): BaaVendorPayload {
  return {
    name: form.name.trim(),
    baa_status: form.baa_status,
    baa_signed_at: form.baa_signed_at || null,
    baa_expires_at: form.baa_expires_at || null,
    covered_services: form.covered_services.trim() || null,
    risk_score: form.risk_score === "" ? null : Number.parseInt(form.risk_score, 10),
  };
}

function normalizeEditPayload(form: VendorFormState): Partial<BaaVendorPayload> {
  return {
    name: form.name.trim(),
    baa_status: form.baa_status,
    baa_signed_at: form.baa_signed_at || null,
    baa_expires_at: form.baa_expires_at || null,
    covered_services: form.covered_services.trim() || null,
  };
}

function vendorFieldPatch(prev: BaaVendor, next: Partial<BaaVendorPayload>): Partial<BaaVendorPayload> {
  const patch: Partial<BaaVendorPayload> = {};
  if (next.name !== undefined && next.name !== prev.name) patch.name = next.name;
  if (next.baa_status !== undefined && next.baa_status !== prev.baa_status) patch.baa_status = next.baa_status;
  if (next.baa_signed_at !== undefined) {
    const prevSigned = prev.baa_signed_at ? prev.baa_signed_at.slice(0, 10) : null;
    if (next.baa_signed_at !== prevSigned) patch.baa_signed_at = next.baa_signed_at;
  }
  if (next.baa_expires_at !== undefined) {
    const prevExpires = prev.baa_expires_at ? prev.baa_expires_at.slice(0, 10) : null;
    if (next.baa_expires_at !== prevExpires) patch.baa_expires_at = next.baa_expires_at;
  }
  if (next.covered_services !== undefined) {
    const prevServices = prev.covered_services ?? null;
    if (next.covered_services !== prevServices) patch.covered_services = next.covered_services;
  }
  return patch;
}

function validateForm(form: VendorFormState, options?: { requireRiskScore?: boolean }): string | null {
  if (!form.name.trim()) return "Company name is required.";
  const requireRiskScore = options?.requireRiskScore ?? false;
  if (requireRiskScore && form.risk_score === "") {
    return "Risk score is required.";
  }
  if (form.risk_score !== "") {
    const parsed = Number.parseInt(form.risk_score, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return "Risk score must be between 0 and 100.";
    }
  }
  if (form.baa_signed_at && Number.isNaN(new Date(form.baa_signed_at).getTime())) {
    return "Signed date is invalid.";
  }
  if (form.baa_expires_at && Number.isNaN(new Date(form.baa_expires_at).getTime())) {
    return "Expiry date is invalid.";
  }
  return null;
}

export default function BaaTrackerPage() {
  const rbac = useDashboardRbac();
  const canWrite = rbac.canWritePage("baa_tracker");
  const [rows, setRows] = useState<BaaVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<VendorFormState>(initialForm);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMouFile, setCreateMouFile] = useState<File | null>(null);
  const [editVendor, setEditVendor] = useState<BaaVendor | null>(null);
  const [editForm, setEditForm] = useState<VendorFormState>(initialForm);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editMouFile, setEditMouFile] = useState<File | null>(null);
  const [mouPreviewLoading, setMouPreviewLoading] = useState(false);

  async function load() {
    setError(null);
    try {
      setRows(await getBaaVendors());
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Failed to load vendors."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const expiringSoon = rows.filter((row) => {
      if (!row.baa_expires_at) return false;
      const d = new Date(row.baa_expires_at);
      const days = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 60;
    }).length;
    return {
      total: rows.length,
      pending: rows.filter((row) => row.baa_status === "PENDING").length,
      fail: rows.filter((row) => row.baa_status === "FAIL").length,
      expiringSoon,
    };
  }, [rows]);

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const validationError = validateForm(createForm, { requireRiskScore: true });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!createMouFile) {
      setError("Please upload the signed MOU file before adding the company.");
      return;
    }
    try {
      setCreateSubmitting(true);
      const created = await createBaaVendor(normalizePayload(createForm));
      await uploadBaaVendorMou(created.id, createMouFile);
      setCreateForm(initialForm);
      setCreateMouFile(null);
      setCreateOpen(false);
      setSuccess("Vendor added successfully.");
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Failed to create vendor."));
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editVendor) return;
    setError(null);
    setSuccess(null);
    const validationError = validateForm(editForm);
    if (validationError) {
      setError(validationError);
      return;
    }
    const fieldPatch = vendorFieldPatch(editVendor, normalizeEditPayload(editForm));
    if (!editMouFile && Object.keys(fieldPatch).length === 0) {
      setError("No changes to save. Update fields or choose a new MOU file.");
      return;
    }
    try {
      setEditSubmitting(true);
      if (editMouFile) {
        await uploadBaaVendorMou(editVendor.id, editMouFile);
      }
      if (Object.keys(fieldPatch).length > 0) {
        await patchBaaVendor(editVendor.id, fieldPatch);
      }
      setSuccess("Vendor updated successfully.");
      setEditVendor(null);
      setEditMouFile(null);
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Failed to update vendor."));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function previewLatestMou(vendorId: string) {
    setError(null);
    try {
      setMouPreviewLoading(true);
      const { url } = await getBaaVendorMouSignedUrl(vendorId, 3600);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Failed to open MOU preview."));
    } finally {
      setMouPreviewLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1280px] space-y-6">
        {rbac.permissionFor("baa_tracker") === "read_only" ? <HsReadOnlyBanner /> : null}
        {error ? (
          <HsAlertBanner variant="WARNING" onDismiss={() => setError(null)}>
            <span className="font-medium">BAA tracker issue:</span> {error}
          </HsAlertBanner>
        ) : null}
        {success ? (
          <HsAlertBanner variant="INFO" onDismiss={() => setSuccess(null)}>
            {success}
          </HsAlertBanner>
        ) : null}

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-hs-caption font-semibold uppercase tracking-[0.1em] text-hs-primary">
                Vendors & Partners
              </p>
              <h1 className="mt-2 text-hs-title font-semibold text-hs-text">BAA Tracker</h1>
              <p className="mt-2 text-hs-body text-hs-muted">
                Registered companies in your organization, loaded from `public.vendors`. Use this list to upload and manage BAA documents.
                Portfolio risk scores and derived statuses can be recalculated from{" "}
                <Link href="/dashboard/vendor-risk-scores" className="font-medium text-hs-primary underline">
                  Vendor risk scores
                </Link>
                ; refresh this page afterward to see updated risk scores and BAA status.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <HsSecondaryButton type="button" onClick={() => void load()} disabled={loading}>
                Refresh
              </HsSecondaryButton>
              {canWrite ? (
                <HsPrimaryButton type="button" onClick={() => setCreateOpen(true)} disabled={loading}>
                  Add company
                </HsPrimaryButton>
              ) : null}
            </div>
          </div>
        </section>

        {loading ? (
          <section className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <HsSkeleton key={index} className="h-24 rounded-hs-card" />
            ))}
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-4">
            <article className="rounded-hs-card border border-hs-border bg-hs-card p-5">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Registered companies</p>
              <p className="mt-2 text-3xl font-semibold text-hs-text">{stats.total}</p>
            </article>
            <article className="rounded-hs-card border border-hs-border bg-hs-card p-5">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Pending BAA</p>
              <p className="mt-2 text-3xl font-semibold text-hs-text">{stats.pending}</p>
            </article>
            <article className="rounded-hs-card border border-hs-border bg-hs-card p-5">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Failed status</p>
              <p className="mt-2 text-3xl font-semibold text-hs-text">{stats.fail}</p>
            </article>
            <article className="rounded-hs-card border border-hs-border bg-hs-card p-5">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Expiring in 60d</p>
              <p className="mt-2 text-3xl font-semibold text-hs-text">{stats.expiringSoon}</p>
            </article>
          </section>
        )}

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <HsSkeleton key={index} className="h-14 rounded-hs" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <HsEmptyState
              title="No vendors registered"
              description="No rows were returned from `public.vendors` for your organization."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="h-12 border-b border-hs-fill bg-hs-page">
                    <th className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Company</th>
                    <th className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">BAA status</th>
                    <th className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Signed date</th>
                    <th className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Expires</th>
                    <th className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Services</th>
                    <th className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Risk score</th>
                    <th className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Created</th>
                    {canWrite ? (
                      <th className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((vendor) => (
                    <tr key={vendor.id} className="h-14 border-b border-hs-fill">
                      <td className="px-4 text-sm font-medium text-hs-text">{vendor.name}</td>
                      <td className="px-4">
                        <span
                          className={cn(
                            "inline-flex rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium",
                            statusStyles[vendor.baa_status],
                          )}
                        >
                          {vendor.baa_status}
                        </span>
                      </td>
                      <td className="px-4 text-sm text-hs-text">{formatDate(vendor.baa_signed_at)}</td>
                      <td className="px-4 text-sm text-hs-text">{formatDate(vendor.baa_expires_at)}</td>
                      <td className="px-4 text-sm text-hs-text">{vendor.covered_services ?? "Not set"}</td>
                      <td className="px-4 text-sm text-hs-text">{vendor.risk_score ?? "-"}</td>
                      <td className="px-4 text-sm text-hs-text">{formatDate(vendor.created_at)}</td>
                      {canWrite ? (
                        <td className="px-4">
                          <HsSecondaryButton
                            type="button"
                            onClick={() => {
                              setEditVendor(vendor);
                              setEditForm(formFromVendor(vendor));
                            }}
                          >
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
        </section>
      </div>
      <HsModal
        open={createOpen}
        onClose={() => {
          if (createSubmitting) return;
          setCreateOpen(false);
          setCreateMouFile(null);
        }}
        title="Add company"
        footer={
          <>
            <HsSecondaryButton
              type="button"
              onClick={() => {
                setCreateOpen(false);
                setCreateMouFile(null);
              }}
              disabled={createSubmitting}
            >
              Cancel
            </HsSecondaryButton>
            <HsPrimaryButton
              form="create-vendor-form"
              type="submit"
              loading={createSubmitting}
            >
              Add company
            </HsPrimaryButton>
          </>
        }
      >
        <form id="create-vendor-form" className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateSubmit}>
          <div className="md:col-span-2 rounded-hs border border-hs-border bg-hs-fill px-3 py-2 text-sm text-hs-text">
            Upload the signed MOU file (PDF, DOC, or DOCX). This is required.
          </div>
          <HsTextInput
            name="name"
            label="Company name"
            value={createForm.name}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <HsSelect
            name="baa_status"
            label="BAA status"
            value={createForm.baa_status}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, baa_status: event.target.value as BaaVendor["baa_status"] }))
            }
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </HsSelect>
          <HsTextInput
            name="baa_signed_at"
            label="Signed date"
            type="date"
            value={createForm.baa_signed_at}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, baa_signed_at: event.target.value }))}
          />
          <HsTextInput
            name="baa_expires_at"
            label="Expiry date"
            type="date"
            value={createForm.baa_expires_at}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, baa_expires_at: event.target.value }))}
          />
          <HsTextInput
            name="risk_score"
            label="Risk score (0-100)"
            type="number"
            min={0}
            max={100}
            value={createForm.risk_score}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, risk_score: event.target.value }))}
          />
          <div className="md:col-span-2">
            <HsTextarea
              name="covered_services"
              label="Covered services"
              value={createForm.covered_services}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, covered_services: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-hs-secondary font-medium text-hs-text">Signed MOU file</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setCreateMouFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-hs border border-hs-border bg-hs-card px-3 py-2 text-sm text-hs-text"
              required
            />
            <p className="mt-1 text-hs-caption text-hs-muted">
              {createMouFile ? `Selected: ${createMouFile.name}` : "No file selected"}
            </p>
          </div>
        </form>
      </HsModal>
      <HsModal
        open={Boolean(editVendor)}
        onClose={() => {
          if (editSubmitting) return;
          setEditVendor(null);
          setEditMouFile(null);
        }}
        title={editVendor ? `Edit ${editVendor.name}` : "Edit vendor"}
        footer={
          <>
            <HsSecondaryButton
              type="button"
              onClick={() => {
                setEditVendor(null);
                setEditMouFile(null);
              }}
              disabled={editSubmitting}
            >
              Cancel
            </HsSecondaryButton>
            <HsPrimaryButton form="edit-vendor-form" type="submit" loading={editSubmitting}>
              Save changes
            </HsPrimaryButton>
          </>
        }
      >
        <form id="edit-vendor-form" className="grid gap-4 md:grid-cols-2" onSubmit={handleEditSubmit}>
          <HsTextInput
            name="edit_name"
            label="Company name"
            value={editForm.name}
            onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <HsSelect
            name="edit_baa_status"
            label="BAA status"
            value={editForm.baa_status}
            onChange={(event) => setEditForm((prev) => ({ ...prev, baa_status: event.target.value as BaaVendor["baa_status"] }))}
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </HsSelect>
          <HsTextInput
            name="edit_baa_signed_at"
            label="Signed date"
            type="date"
            value={editForm.baa_signed_at}
            onChange={(event) => setEditForm((prev) => ({ ...prev, baa_signed_at: event.target.value }))}
          />
          <HsTextInput
            name="edit_baa_expires_at"
            label="Expiry date"
            type="date"
            value={editForm.baa_expires_at}
            onChange={(event) => setEditForm((prev) => ({ ...prev, baa_expires_at: event.target.value }))}
          />
          <HsTextInput
            name="edit_risk_score"
            label="Risk score (0-100)"
            type="number"
            min={0}
            max={100}
            value={editForm.risk_score}
            disabled
            helperText="Risk score is managed by system policy and cannot be edited here."
          />
          <div className="md:col-span-2">
            <HsTextarea
              name="edit_covered_services"
              label="Covered services"
              value={editForm.covered_services}
              onChange={(event) => setEditForm((prev) => ({ ...prev, covered_services: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-hs-secondary font-medium text-hs-text">Replace signed MOU file</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setEditMouFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-hs border border-hs-border bg-hs-card px-3 py-2 text-sm text-hs-text"
            />
            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-hs-caption text-hs-muted">
                {editMouFile ? (
                  <>Selected replacement: {editMouFile.name}</>
                ) : editVendor?.mou_document_path ? (
                  <>
                    Latest MOU on file
                    {editVendor.mou_uploaded_at ? ` · uploaded ${formatDate(editVendor.mou_uploaded_at)}` : null}
                    {mouFileLabelFromPath(editVendor.mou_document_path)
                      ? ` · ${mouFileLabelFromPath(editVendor.mou_document_path)}`
                      : null}
                  </>
                ) : (
                  <>No MOU uploaded yet</>
                )}
              </p>
              {editVendor?.mou_document_path ? (
                <HsSecondaryButton
                  type="button"
                  disabled={mouPreviewLoading}
                  onClick={() => void previewLatestMou(editVendor.id)}
                >
                  {mouPreviewLoading ? "Opening…" : "Preview latest MOU"}
                </HsSecondaryButton>
              ) : null}
            </div>
          </div>
        </form>
      </HsModal>
    </div>
  );
}
