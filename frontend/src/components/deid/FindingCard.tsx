"use client";

import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";

export function FindingCard({
  finding,
  onFix,
}: {
  finding: Record<string, unknown>;
  onFix?: (finding: Record<string, unknown>) => void;
}) {
  return (
    <article className="rounded-hs border border-hs-border bg-hs-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-hs-body font-semibold text-hs-text">
          {String(finding.identifier_type ?? "Identifier")} {finding.safe_harbor_item ? `— item ${String(finding.safe_harbor_item)}` : ""}
        </p>
        <span
          className={`rounded-hs-pill border px-2 py-0.5 text-[11px] ${
            finding.severity === "blocker" ? "border-rose-300 bg-rose-100 text-rose-900" : "border-amber-300 bg-amber-100 text-amber-900"
          }`}
        >
          {String(finding.severity ?? "warning")}
        </span>
      </div>
      <p className="mt-1 text-hs-caption text-hs-secondary">
        Column: <span className="font-medium">{String(finding.column_name ?? "n/a")}</span> · Pattern:{" "}
        <span className="font-medium">{String(finding.sample_pattern ?? "n/a")}</span> · Rows affected:{" "}
        <span className="font-medium">{String(finding.row_count_affected ?? 0)}</span>
      </p>
      <p className="mt-2 text-hs-caption text-hs-muted">{String(finding.remediation ?? "")}</p>
      {onFix ? (
        <div className="mt-3">
          <HsSecondaryButton type="button" className="h-8 px-2 text-hs-caption" onClick={() => onFix(finding)}>
            Fix this with De-identifier
          </HsSecondaryButton>
        </div>
      ) : null}
    </article>
  );
}
