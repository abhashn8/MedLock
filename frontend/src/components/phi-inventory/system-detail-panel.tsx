"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { PhiSystem, PhiSystemAuditLogRow, PhiSystemReviewRow } from "@/lib/api/types";
import { HsModal } from "@/components/hipaa-shield/HsModal";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { HsTextarea } from "@/components/hipaa-shield/HsTextarea";
import { ClassificationBadge, PhiTypeTag, SystemStatusBadge, SystemTypeIcon } from "./tags-and-badges";
import { OwnerCell, RetentionCell } from "./cells";

export function SystemDetailPanel({
  system,
  onEdit,
  canWrite = true,
  onDecommissioned,
  onReviewSubmitted,
}: {
  system: PhiSystem;
  onEdit: () => void;
  canWrite?: boolean;
  onDecommissioned: () => void;
  onReviewSubmitted: () => void;
}) {
  const [reviews, setReviews] = useState<PhiSystemReviewRow[]>([]);
  const [auditRows, setAuditRows] = useState<PhiSystemAuditLogRow[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewStep, setReviewStep] = useState(1);
  const [reviewRole, setReviewRole] = useState("privacy_officer");
  const [coSignerId, setCoSignerId] = useState("");
  const [coSignerRole, setCoSignerRole] = useState("");
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(false);
  const [check4, setCheck4] = useState(false);
  const [check5, setCheck5] = useState(false);
  const [changesMade, setChangesMade] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDecom, setConfirmDecom] = useState(false);
  const [decomStep, setDecomStep] = useState(1);
  const [decomMethod, setDecomMethod] = useState("Secure deletion (DoD 5220.22-M or equivalent)");
  const [decomDate, setDecomDate] = useState(new Date().toISOString().slice(0, 10));
  const [decomAuthorizedBy, setDecomAuthorizedBy] = useState("");
  const [decomSuccessorSystem, setDecomSuccessorSystem] = useState("");
  const [decomLegalHoldRef, setDecomLegalHoldRef] = useState("");
  const [decomNotes, setDecomNotes] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<"reviews" | "activity" | "gaps">("reviews");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingReviews(true);
      try {
        const res = await apiFetch(`/api/phi-inventory/${system.id}/reviews`);
        const data = (await res.json()) as PhiSystemReviewRow[];
        if (!cancelled && res.ok) setReviews(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoadingReviews(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [system.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadAudit() {
      setLoadingAudit(true);
      try {
        const res = await apiFetch(`/api/phi-inventory/${system.id}/audit-log`);
        const data = (await res.json()) as PhiSystemAuditLogRow[];
        if (!cancelled && res.ok) setAuditRows(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoadingAudit(false);
      }
    }
    void loadAudit();
    return () => {
      cancelled = true;
    };
  }, [system.id]);

  const checklistConfirmed = check1 && check2 && check3 && check4 && check5;

  async function submitReview() {
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/phi-inventory/${system.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          changes_made: changesMade.trim(),
          reviewer_role: reviewRole,
          checklist_confirmed: checklistConfirmed,
          cosigner_id: coSignerId || null,
          cosigner_role: coSignerRole || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err?.message === "string" ? err.message : "Review failed.");
      }
      setReviewOpen(false);
      setReviewStep(1);
      setChangesMade("");
      onReviewSubmitted();
      const listRes = await apiFetch(`/api/phi-inventory/${system.id}/reviews`);
      const data = (await listRes.json()) as PhiSystemReviewRow[];
      if (listRes.ok) setReviews(Array.isArray(data) ? data : []);
    } catch {
      /* keep modal open; optional toast */
    } finally {
      setSubmitting(false);
    }
  }

  async function decommission() {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/phi-inventory/${system.id}/decommission`, {
        method: "POST",
        body: JSON.stringify({
          method: decomMethod,
          date: decomDate,
          authorized_by: decomAuthorizedBy || undefined,
          successor_system: decomMethod.includes("Transferred") ? decomSuccessorSystem || undefined : undefined,
          legal_hold_ref: decomMethod.includes("legal hold") ? decomLegalHoldRef || undefined : undefined,
          notes: decomNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err?.message === "string" ? err.message : "Could not decommission.");
      }
      setConfirmDecom(false);
      setDecomStep(1);
      onDecommissioned();
    } catch {
      setConfirmDecom(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hs-fill pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <SystemTypeIcon systemType={system.system_type} />
          <div className="min-w-0">
            <h2 className="text-hs-section font-semibold text-hs-text">{system.name}</h2>
            <p className="mt-1 text-hs-caption text-hs-muted">
              {system.department} · {system.system_type.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <HsSecondaryButton type="button" onClick={onEdit}>
              Edit
            </HsSecondaryButton>
            {system.status !== "decommissioned" ? (
              <HsSecondaryButton type="button" className="border-hs-danger-border text-hs-danger" onClick={() => setConfirmDecom(true)}>
                Decommission
              </HsSecondaryButton>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Status</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <SystemStatusBadge status={system.status} />
              <ClassificationBadge classification={system.classification} />
            </div>
          </div>
          {system.description?.trim() ? (
            <div>
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-hs-body text-hs-secondary">{system.description}</p>
            </div>
          ) : null}
          <div>
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">PHI types</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(system.phi_types ?? []).map((t) => (
                <PhiTypeTag key={t} type={t} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Owners</p>
            <div className="mt-2">
              <OwnerCell system={system} onAssign={canWrite ? onEdit : undefined} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Host / URL</p>
            <p className="mt-1 break-all font-mono text-hs-caption text-hs-secondary">{system.host_or_url ?? "—"}</p>
          </div>
          <div>
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Retention</p>
            <div className="mt-2">
              <RetentionCell system={system} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-hs-caption">
            <div>
              <p className="font-medium uppercase tracking-wide text-hs-muted">Review cadence</p>
              <p className="mt-1 text-hs-text">{system.review_cadence.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="font-medium uppercase tracking-wide text-hs-muted">Next review</p>
              <p className="mt-1 text-hs-text">
                {system.next_review_due_at
                  ? `${new Date(system.next_review_due_at).toLocaleDateString()} (${formatDistanceToNow(new Date(system.next_review_due_at), { addSuffix: true })})`
                  : "Not scheduled"}
              </p>
            </div>
          </div>
          <div>
            <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Source</p>
            <p className="mt-1 text-hs-body text-hs-text">{system.source === "scanner" ? "Scanner" : "Manual"}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-hs-fill pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-hs-pill px-3 py-1 text-hs-caption ${tab === "reviews" ? "bg-hs-fill text-hs-text" : "text-hs-muted"}`}
              onClick={() => setTab("reviews")}
            >
              Review history
            </button>
            <button
              type="button"
              className={`rounded-hs-pill px-3 py-1 text-hs-caption ${tab === "activity" ? "bg-hs-fill text-hs-text" : "text-hs-muted"}`}
              onClick={() => setTab("activity")}
            >
              Activity
            </button>
            <button
              type="button"
              className={`rounded-hs-pill px-3 py-1 text-hs-caption ${tab === "gaps" ? "bg-hs-fill text-hs-text" : "text-hs-muted"}`}
              onClick={() => setTab("gaps")}
            >
              Compliance gaps
            </button>
          </div>
          {canWrite && system.status !== "decommissioned" ? (
            <HsPrimaryButton type="button" onClick={() => setReviewOpen(true)}>
              Start review
            </HsPrimaryButton>
          ) : null}
        </div>
        {tab === "reviews" && loadingReviews ? (
          <p className="mt-4 text-hs-caption text-hs-muted">Loading reviews…</p>
        ) : tab === "reviews" && reviews.length === 0 ? (
          <p className="mt-4 text-hs-caption text-hs-muted">No reviews recorded yet.</p>
        ) : tab === "reviews" ? (
          <ul className="mt-4 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-hs border border-hs-border bg-hs-page/60 p-3">
                <p className="text-hs-caption font-medium text-hs-text">
                  {new Date(r.reviewed_at).toLocaleString()}
                  {r.reviewer_name ? <span className="font-normal text-hs-muted"> · {r.reviewer_name}</span> : null}
                </p>
                {r.changes_made?.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap text-hs-caption text-hs-secondary">{r.changes_made}</p>
                ) : (
                  <p className="mt-1 text-hs-caption text-hs-muted">No changes noted.</p>
                )}
                <p className="mt-1 text-[11px] text-hs-muted">
                  Next due: {new Date(r.next_review_due_at).toLocaleDateString()}
                </p>
                <div className="mt-2">
                  <HsSecondaryButton
                    type="button"
                    className="h-8 px-2 text-hs-caption"
                    onClick={() => window.open(`/api/phi-inventory/${system.id}/review/${r.id}/certificate`, "_blank")}
                  >
                    Download certificate
                  </HsSecondaryButton>
                </div>
              </li>
            ))}
          </ul>
        ) : tab === "activity" ? (
          loadingAudit ? (
            <p className="mt-4 text-hs-caption text-hs-muted">Loading activity…</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {auditRows.map((r) => (
                <li key={r.id} className="rounded-hs border border-hs-border bg-hs-page/60 p-3">
                  <p className="text-hs-caption text-hs-text">
                    <span className="font-medium">{r.changed_by_name ?? "System"}</span> · {r.action}
                  </p>
                  {r.field_name ? (
                    <p className="mt-1 text-hs-caption text-hs-secondary">
                      {r.field_name}: {r.old_value ?? "—"} → {r.new_value ?? "—"}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-hs-muted">
                    {formatDistanceToNow(new Date(r.changed_at), { addSuffix: true })}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="mt-4 space-y-2 text-hs-caption text-hs-secondary">
            {Array.isArray(system.compliance_gaps) && system.compliance_gaps.length > 0 ? (
              (system.compliance_gaps as Array<{ key: string; citation: string }>).map((gap) => (
                <p key={gap.key} className="rounded-hs border border-hs-border bg-hs-page/60 px-3 py-2">
                  <span className="font-medium">{gap.key.replace(/_/g, " ")}</span>: {gap.citation}
                </p>
              ))
            ) : (
              <p>No active compliance gaps detected.</p>
            )}
          </div>
        )}
      </div>

      <HsModal
        open={reviewOpen}
        onClose={() => !submitting && setReviewOpen(false)}
        title="Complete review"
        footer={
          <>
            <HsSecondaryButton type="button" disabled={submitting} onClick={() => setReviewOpen(false)}>
              Cancel
            </HsSecondaryButton>
            <HsPrimaryButton
              type="button"
              loading={submitting}
              disabled={reviewStep < 3 || !changesMade.trim() || !checklistConfirmed}
              onClick={() => void submitReview()}
            >
              Submit review
            </HsPrimaryButton>
          </>
        }
      >
        {reviewStep === 1 ? (
          <div className="space-y-2 text-hs-body text-hs-secondary">
            <label className="flex gap-2"><input type="checkbox" checked={check1} onChange={(e) => setCheck1(e.target.checked)} /> PHI types listed are still accurate</label>
            <label className="flex gap-2"><input type="checkbox" checked={check2} onChange={(e) => setCheck2(e.target.checked)} /> Business and technical owners are current</label>
            <label className="flex gap-2"><input type="checkbox" checked={check3} onChange={(e) => setCheck3(e.target.checked)} /> Retention policy matches legal requirements</label>
            <label className="flex gap-2"><input type="checkbox" checked={check4} onChange={(e) => setCheck4(e.target.checked)} /> Encryption and access controls are in place</label>
            <label className="flex gap-2"><input type="checkbox" checked={check5} onChange={(e) => setCheck5(e.target.checked)} /> No new systems inherited this PHI</label>
          </div>
        ) : null}
        {reviewStep === 2 ? (
          <div className="space-y-3">
            <HsSelect label="Reviewer role" value={reviewRole} onChange={(e) => setReviewRole(e.target.value)}>
              <option value="privacy_officer">Privacy Officer</option>
              <option value="compliance_manager">Compliance Manager</option>
              <option value="system_owner">System Owner</option>
              <option value="security_officer">Security Officer</option>
            </HsSelect>
            <HsTextInput label="Co-signer user ID (optional)" value={coSignerId} onChange={(e) => setCoSignerId(e.target.value)} />
            <HsTextInput label="Co-signer role (optional)" value={coSignerRole} onChange={(e) => setCoSignerRole(e.target.value)} />
          </div>
        ) : null}
        {reviewStep === 3 ? (
          <div className="rounded-hs border border-hs-border bg-hs-page/60 p-3 text-hs-caption text-hs-secondary">
            <p className="font-medium text-hs-text">Certificate preview</p>
            <p>System: {system.name}</p>
            <p>Classification: {system.classification}</p>
            <p>Reviewer role: {reviewRole}</p>
            <p>Checklist confirmed: yes</p>
          </div>
        ) : null}
        <div className="mt-4">
          <HsTextarea
            label="Changes made"
            value={changesMade}
            onChange={(e) => setChangesMade(e.target.value)}
            rows={5}
            placeholder="e.g. Updated retention to 7 years per legal; assigned technical owner."
          />
        </div>
        <div className="mt-4 flex justify-between">
          <HsSecondaryButton type="button" disabled={reviewStep <= 1} onClick={() => setReviewStep((s) => Math.max(1, s - 1))}>
            Back
          </HsSecondaryButton>
          {reviewStep < 3 ? (
            <HsPrimaryButton
              type="button"
              disabled={(reviewStep === 1 && !checklistConfirmed) || (reviewStep === 2 && !changesMade.trim())}
              onClick={() => setReviewStep((s) => Math.min(3, s + 1))}
            >
              Next
            </HsPrimaryButton>
          ) : null}
        </div>
      </HsModal>

      <HsModal
        open={confirmDecom}
        onClose={() => !deleting && setConfirmDecom(false)}
        title="Decommission system?"
        footer={
          <>
            <HsSecondaryButton type="button" disabled={deleting} onClick={() => setConfirmDecom(false)}>
              Cancel
            </HsSecondaryButton>
            <HsPrimaryButton type="button" loading={deleting} disabled={decomStep < 3} onClick={() => void decommission()}>
              Decommission
            </HsPrimaryButton>
          </>
        }
      >
        {decomStep === 1 ? (
          <div className="space-y-2 text-hs-caption text-hs-secondary">
            <p className="font-medium text-hs-text">{system.name}</p>
            <p>{system.classification}</p>
            <p>{(system.phi_types ?? []).join(", ")}</p>
            <p>
              This system will be marked decommissioned. The record is retained permanently per HIPAA §164.316(b)(1).
            </p>
          </div>
        ) : null}
        {decomStep === 2 ? (
          <div className="space-y-3">
            <HsSelect label="PHI disposition method" value={decomMethod} onChange={(e) => setDecomMethod(e.target.value)}>
              <option>Secure deletion (DoD 5220.22-M or equivalent)</option>
              <option>Cryptographic erasure</option>
              <option>Physical destruction</option>
              <option>Transferred to successor system</option>
              <option>Retained under legal hold</option>
            </HsSelect>
            {decomMethod.includes("Transferred") ? (
              <HsTextInput label="Successor system" value={decomSuccessorSystem} onChange={(e) => setDecomSuccessorSystem(e.target.value)} />
            ) : null}
            {decomMethod.includes("legal hold") ? (
              <HsTextInput label="Legal hold reference" value={decomLegalHoldRef} onChange={(e) => setDecomLegalHoldRef(e.target.value)} />
            ) : null}
            <HsTextInput label="Destruction date" type="date" value={decomDate} onChange={(e) => setDecomDate(e.target.value)} />
            <HsTextInput label="Authorized by (user ID)" value={decomAuthorizedBy} onChange={(e) => setDecomAuthorizedBy(e.target.value)} />
            <HsTextarea label="Evidence / notes" value={decomNotes} onChange={(e) => setDecomNotes(e.target.value)} rows={3} />
          </div>
        ) : null}
        {decomStep === 3 ? (
          <div className="rounded-hs border border-hs-border bg-hs-page/60 p-3 text-hs-caption text-hs-secondary">
            <p className="font-medium text-hs-text">Decommission certificate preview</p>
            <p>System: {system.name}</p>
            <p>PHI disposition: {decomMethod}</p>
            <p>Authorized by: {decomAuthorizedBy || "TBD"}</p>
          </div>
        ) : null}
        <div className="mt-4 flex justify-between">
          <HsSecondaryButton type="button" disabled={decomStep <= 1} onClick={() => setDecomStep((s) => Math.max(1, s - 1))}>
            Back
          </HsSecondaryButton>
          {decomStep < 3 ? (
            <HsPrimaryButton type="button" onClick={() => setDecomStep((s) => Math.min(3, s + 1))}>
              Next
            </HsPrimaryButton>
          ) : (
            <HsSecondaryButton type="button" onClick={() => window.open(`/api/phi-inventory/${system.id}/decommission/certificate`, "_blank")}>
              Preview certificate
            </HsSecondaryButton>
          )}
        </div>
      </HsModal>
    </section>
  );
}
