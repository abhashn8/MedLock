"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api/client";
import type { PhiSystem } from "@/lib/api/types";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { HsTextarea } from "@/components/hipaa-shield/HsTextarea";
import { cn } from "@/lib/utils";
import { ALL_PHI_TYPES } from "./tags-and-badges";

function emptyDraft(): PhiSystem {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "",
    description: null,
    system_type: "other",
    host_or_url: null,
    department: "General",
    classification: "clinical",
    phi_types: ["other"],
    business_owner_id: null,
    technical_owner_id: null,
    encryption_at_rest: false,
    encryption_at_rest_method: null,
    encryption_in_transit: true,
    encryption_in_transit_protocol: "TLS 1.2+",
    access_control_method: "rbac",
    baa_required: false,
    baa_id: null,
    retention_years: null,
    retention_legal_basis: null,
    retention_notes: null,
    review_cadence: "annual",
    last_reviewed_at: null,
    next_review_due_at: null,
    source: "manual",
    phi_scan_id: null,
    status: "needs_review",
    notes: null,
    created_at: now,
    updated_at: now,
  };
}

function toPayload(d: PhiSystem): Record<string, unknown> {
  return {
    name: d.name.trim(),
    description: d.description?.trim() ? d.description.trim() : null,
    system_type: d.system_type,
    host_or_url: d.host_or_url?.trim() ? d.host_or_url.trim() : null,
    department: d.department.trim() || "General",
    classification: d.classification,
    phi_types: d.phi_types.length ? d.phi_types : ["other"],
    business_owner_id: d.business_owner_id?.trim() || null,
    technical_owner_id: d.technical_owner_id?.trim() || null,
    encryption_at_rest: d.encryption_at_rest,
    encryption_at_rest_method: d.encryption_at_rest_method?.trim() || null,
    encryption_in_transit: d.encryption_in_transit,
    encryption_in_transit_protocol: d.encryption_in_transit_protocol?.trim() || null,
    access_control_method: d.access_control_method,
    baa_required: d.baa_required,
    baa_id: d.baa_id?.trim() || null,
    retention_years: d.retention_years === null || d.retention_years === ("" as unknown as number) ? null : Number(d.retention_years),
    retention_legal_basis: d.retention_legal_basis,
    retention_notes: d.retention_notes?.trim() || null,
    review_cadence: d.review_cadence,
    last_reviewed_at: d.last_reviewed_at,
    notes: d.notes?.trim() || null,
  };
}

export function SystemSlideOver({
  open,
  onClose,
  mode,
  system,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  system: PhiSystem | null;
  onSaved: () => void;
}) {
  const titleId = useId();
  const [draft, setDraft] = useState<PhiSystem>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && system) {
      setDraft({ ...system, phi_types: [...(system.phi_types ?? [])] });
    } else {
      setDraft(emptyDraft());
    }
  }, [open, mode, system]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSave() {
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = toPayload(draft);
      if (typeof body.retention_years === "number" && !Number.isFinite(body.retention_years)) {
        body.retention_years = null;
      }
      const res =
        mode === "create"
          ? await apiFetch("/api/phi-inventory", { method: "POST", body: JSON.stringify(body) })
          : await apiFetch(`/api/phi-inventory/${system?.id}`, { method: "PATCH", body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.message === "string" ? data.message : "Save failed.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function togglePhiType(t: string) {
    setDraft((d) => {
      const set = new Set(d.phi_types);
      if (set.has(t)) set.delete(t);
      else set.add(t);
      const next = Array.from(set);
      return { ...d, phi_types: next.length ? next : ["other"] };
    });
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[190] bg-hs-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed right-0 top-0 z-[191] flex h-full w-full max-w-lg flex-col border-l border-hs-border bg-hs-card shadow-hs-modal",
          "translate-x-0 transition-transform duration-200 ease-out",
        )}
      >
        <header className="flex shrink-0 items-start justify-between border-b border-hs-border px-6 py-5">
          <h2 id={titleId} className="text-hs-section font-semibold text-hs-text">
            {mode === "create" ? "Add PHI system" : "Edit PHI system"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-hs-muted hs-transition-border hover:bg-hs-fill"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p className="mb-4 rounded-hs border border-hs-danger-border bg-hs-danger-bg px-3 py-2 text-hs-caption text-hs-danger">{error}</p>
          ) : null}

          <div className="space-y-8">
            <section className="space-y-3">
              <h3 className="text-hs-caption font-semibold uppercase tracking-wide text-hs-muted">A · Identity</h3>
              <HsTextInput label="Name *" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} required />
              <HsTextarea
                label="Description"
                value={draft.description ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value || null }))}
                rows={3}
              />
              <HsSelect
                label="System type"
                value={draft.system_type}
                onChange={(e) => setDraft((d) => ({ ...d, system_type: e.target.value as PhiSystem["system_type"] }))}
              >
                <option value="database">Database</option>
                <option value="object_storage">Object storage</option>
                <option value="api">API</option>
                <option value="saas">SaaS</option>
                <option value="email">Email</option>
                <option value="file_share">File share</option>
                <option value="backup">Backup</option>
                <option value="other">Other</option>
              </HsSelect>
              <HsTextInput
                label="Host or URL"
                value={draft.host_or_url ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, host_or_url: e.target.value || null }))}
              />
              <HsTextInput
                label="Department"
                value={draft.department}
                onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-hs-caption font-semibold uppercase tracking-wide text-hs-muted">B · Classification</h3>
              <HsSelect
                label="Data classification"
                value={draft.classification}
                onChange={(e) => setDraft((d) => ({ ...d, classification: e.target.value as PhiSystem["classification"] }))}
              >
                <option value="clinical">Clinical</option>
                <option value="direct_identifier">Direct identifier</option>
                <option value="financial">Financial</option>
                <option value="contact">Contact</option>
                <option value="derived">Derived</option>
              </HsSelect>
              <div>
                <p className="mb-2 text-hs-secondary font-medium text-[#374151]">PHI types present</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_PHI_TYPES.map((t) => {
                    const on = draft.phi_types.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => togglePhiType(t)}
                        className={cn(
                          "rounded-hs-pill border px-2 py-1 text-[11px] font-medium transition-colors",
                          on ? "border-hs-primary bg-hs-info-bg text-hs-primary" : "border-hs-border bg-hs-fill text-hs-muted",
                        )}
                      >
                        {t.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-hs-caption font-semibold uppercase tracking-wide text-hs-muted">C · Ownership</h3>
              <p className="text-hs-caption text-hs-muted">Paste Supabase auth user UUIDs for owners (optional).</p>
              <HsTextInput
                label="Business owner user ID"
                value={draft.business_owner_id ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, business_owner_id: e.target.value || null }))}
              />
              <HsTextInput
                label="Technical owner user ID"
                value={draft.technical_owner_id ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, technical_owner_id: e.target.value || null }))}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-hs-caption font-semibold uppercase tracking-wide text-hs-muted">D · Security</h3>
              <label className="flex items-center gap-2 text-hs-body text-hs-text">
                <input
                  type="checkbox"
                  checked={draft.encryption_at_rest}
                  onChange={(e) => setDraft((d) => ({ ...d, encryption_at_rest: e.target.checked }))}
                />
                Encryption at rest
              </label>
              <HsTextInput
                label="At-rest method"
                value={draft.encryption_at_rest_method ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, encryption_at_rest_method: e.target.value || null }))}
              />
              <label className="flex items-center gap-2 text-hs-body text-hs-text">
                <input
                  type="checkbox"
                  checked={draft.encryption_in_transit}
                  onChange={(e) => setDraft((d) => ({ ...d, encryption_in_transit: e.target.checked }))}
                />
                Encryption in transit
              </label>
              <HsTextInput
                label="In-transit protocol"
                value={draft.encryption_in_transit_protocol ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, encryption_in_transit_protocol: e.target.value || null }))}
              />
              <HsSelect
                label="Access control"
                value={draft.access_control_method}
                onChange={(e) => setDraft((d) => ({ ...d, access_control_method: e.target.value as PhiSystem["access_control_method"] }))}
              >
                <option value="rbac">RBAC</option>
                <option value="iam">IAM</option>
                <option value="password">Password</option>
                <option value="none">None</option>
              </HsSelect>
              <label className="flex items-center gap-2 text-hs-body text-hs-text">
                <input
                  type="checkbox"
                  checked={draft.baa_required}
                  onChange={(e) => setDraft((d) => ({ ...d, baa_required: e.target.checked }))}
                />
                BAA required
              </label>
              <HsTextInput
                label="BAA record ID (optional)"
                value={draft.baa_id ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, baa_id: e.target.value || null }))}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-hs-caption font-semibold uppercase tracking-wide text-hs-muted">E · Retention & review</h3>
              <HsTextInput
                label="Retention (years)"
                type="number"
                min={0}
                value={draft.retention_years ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => ({
                    ...d,
                    retention_years: v === "" ? null : Math.max(0, Math.floor(Number(v))),
                  }));
                }}
              />
              <HsSelect
                label="Retention legal basis"
                value={draft.retention_legal_basis ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    retention_legal_basis: (e.target.value || null) as PhiSystem["retention_legal_basis"],
                  }))
                }
              >
                <option value="">Not set</option>
                <option value="hipaa_minimum">HIPAA minimum</option>
                <option value="state_law">State law</option>
                <option value="contract">Contract</option>
                <option value="custom">Custom</option>
              </HsSelect>
              <HsTextarea
                label="Retention notes"
                value={draft.retention_notes ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, retention_notes: e.target.value || null }))}
                rows={2}
              />
              <HsSelect
                label="Review cadence"
                value={draft.review_cadence}
                onChange={(e) => setDraft((d) => ({ ...d, review_cadence: e.target.value as PhiSystem["review_cadence"] }))}
              >
                <option value="quarterly">Quarterly</option>
                <option value="semi_annual">Semi-annual</option>
                <option value="annual">Annual</option>
              </HsSelect>
              <HsTextarea
                label="Notes"
                value={draft.notes ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value || null }))}
                rows={3}
              />
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-t border-hs-border px-6 py-4">
          <HsSecondaryButton type="button" onClick={onClose} disabled={saving}>
            Cancel
          </HsSecondaryButton>
          <HsPrimaryButton type="button" loading={saving} onClick={() => void handleSave()}>
            Save
          </HsPrimaryButton>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
