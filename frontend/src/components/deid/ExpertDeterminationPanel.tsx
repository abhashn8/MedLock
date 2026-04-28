"use client";

import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { HsTextarea } from "@/components/hipaa-shield/HsTextarea";

export function ExpertDeterminationPanel({
  assessment,
  onSubmitReview,
}: {
  assessment: Record<string, unknown>;
  onSubmitReview?: (payload: { expert_reviewer_id: string; expert_credentials: string; expert_notes: string; approved: boolean }) => Promise<void>;
}) {
  const risk = Number(assessment.reidentification_risk ?? 0);
  const k = Number(assessment.kanonymity_value ?? 0);
  const quasi = ((assessment.quasi_identifiers as string[] | undefined) ?? []).join(", ");
  const needs = Boolean(assessment.status === "needs_expert" || assessment.requires_human_expert);

  return (
    <div className="space-y-3 rounded-hs-card border border-hs-border bg-hs-card p-5">
      <h3 className="text-hs-section font-semibold text-hs-text">Expert Determination</h3>
      <p className="text-hs-caption text-hs-secondary">Re-identification risk: <span className="font-medium">{risk.toFixed(3)}</span></p>
      <p className="text-hs-caption text-hs-secondary">k-anonymity: <span className="font-medium">k = {k}</span></p>
      <p className="text-hs-caption text-hs-secondary">Quasi-identifiers: {quasi || "None"}</p>
      {needs && onSubmitReview ? <ExpertReviewForm onSubmitReview={onSubmitReview} /> : null}
    </div>
  );
}

function ExpertReviewForm({
  onSubmitReview,
}: {
  onSubmitReview: (payload: { expert_reviewer_id: string; expert_credentials: string; expert_notes: string; approved: boolean }) => Promise<void>;
}) {
  return (
    <form
      className="space-y-3 border-t border-hs-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        void onSubmitReview({
          expert_reviewer_id: String(fd.get("expert_reviewer_id") ?? ""),
          expert_credentials: String(fd.get("expert_credentials") ?? ""),
          expert_notes: String(fd.get("expert_notes") ?? ""),
          approved: String(fd.get("decision") ?? "approve") === "approve",
        });
      }}
    >
      <HsTextInput name="expert_reviewer_id" label="Expert reviewer user ID" required />
      <HsTextInput name="expert_credentials" label="Reviewer credentials" required />
      <HsTextarea name="expert_notes" label="Expert notes" rows={3} />
      <HsSelect name="decision" label="Decision">
        <option value="approve">Approve</option>
        <option value="reject">Reject</option>
      </HsSelect>
      <HsPrimaryButton type="submit">Submit expert review</HsPrimaryButton>
    </form>
  );
}
