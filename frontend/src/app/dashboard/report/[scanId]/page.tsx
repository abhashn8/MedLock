"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import type { PhiFinding, Scan } from "@/lib/api/types";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { cn } from "@/lib/utils";

type Severity = PhiFinding["severity"];

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; scan: Scan };

const SEVERITY_ORDER: Severity[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational",
];

const SEVERITY_PENALTY: Record<Severity, number> = {
  Critical: 10,
  High: 5,
  Medium: 2,
  Low: 1,
  Informational: 0,
};

function computeScore(findings: PhiFinding[]): number {
  let penalty = 0;
  for (const f of findings) {
    penalty += SEVERITY_PENALTY[f.severity] ?? 0;
  }
  return Math.max(0, 100 - penalty);
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-hs-success";
  if (score >= 50) return "text-hs-warning";
  return "text-hs-danger";
}

function severityChipClasses(severity: Severity): string {
  if (severity === "Critical")
    return "border-hs-danger-border bg-hs-danger-bg text-hs-danger";
  if (severity === "High")
    return "border-[#FDE68A] bg-hs-warning-bg text-hs-warning";
  if (severity === "Medium")
    return "border-[#BFDBFE] bg-hs-info-bg text-hs-primary";
  if (severity === "Low")
    return "border-hs-success-border bg-hs-low-bg text-hs-low-text";
  return "border-hs-border bg-hs-fill text-hs-muted";
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-hs-pill border px-2 py-1 text-[11px] font-medium leading-none",
        severityChipClasses(severity),
      )}
    >
      {severity}
    </span>
  );
}

export default function ReportPage() {
  const params = useParams<{ scanId: string }>();
  const scanId = params.scanId;

  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await apiFetch(`/api/scans/${scanId}`);
      const data = await res.json();

      if (cancelled) return;

      if (!res.ok) {
        setState({
          kind: "error",
          message:
            typeof data?.message === "string" ? data.message : "Scan not found.",
        });
        return;
      }

      setState({ kind: "ready", scan: data as Scan });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  const grouped = useMemo(() => {
    if (state.kind !== "ready") return null;
    const buckets: Record<Severity, PhiFinding[]> = {
      Critical: [],
      High: [],
      Medium: [],
      Low: [],
      Informational: [],
    };
    for (const f of state.scan.findings ?? []) {
      const bucket = buckets[f.severity];
      if (bucket) bucket.push(f);
    }
    return buckets;
  }, [state]);

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[960px] space-y-6">
        <nav className="text-hs-secondary font-medium text-hs-muted">
          <Link href="/dashboard" className="text-hs-primary hover:underline">
            Dashboard
          </Link>
          <span className="mx-2 text-hs-placeholder">/</span>
          <span className="text-hs-text">Report</span>
        </nav>

        {state.kind === "loading" && (
          <div className="space-y-4" aria-busy>
            <HsSkeleton className="h-8 w-2/3 max-w-md" />
            <div className="grid gap-4 sm:grid-cols-3">
              <HsSkeleton className="h-28 rounded-hs-card" rounded="md" />
              <HsSkeleton className="h-28 rounded-hs-card" rounded="md" />
              <HsSkeleton className="h-28 rounded-hs-card" rounded="md" />
            </div>
            <HsSkeleton className="h-40 w-full" rounded="md" />
          </div>
        )}

        {state.kind === "error" && (
          <div
            className="border-l-4 border-hs-danger bg-hs-danger-bg px-6 py-4 text-hs-body text-hs-text"
            role="alert"
          >
            <span className="font-medium text-hs-danger">Error:</span>{" "}
            {state.message}
          </div>
        )}

        {state.kind === "ready" && grouped && (
          <ReportBody scan={state.scan} grouped={grouped} />
        )}
      </div>
    </div>
  );
}

function ReportBody({
  scan,
  grouped,
}: {
  scan: Scan;
  grouped: Record<Severity, PhiFinding[]>;
}) {
  const findings = scan.findings ?? [];
  const total = findings.length;
  const score = computeScore(findings);
  const repoLabel = scan.repo_owner
    ? `${scan.repo_owner} / ${scan.repo_name}`
    : scan.repo_name;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
          {repoLabel}
        </p>
        <h1 className="text-hs-title font-semibold text-hs-text">
          PHI scan report
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
            Safety score
          </p>
          <p className={cn("mt-2 text-hs-metric font-semibold", scoreColor(score))}>
            {score}
            <span className="text-hs-section font-semibold text-hs-muted">/100</span>
          </p>
        </div>
        <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
            Total findings
          </p>
          <p className="mt-2 text-hs-metric font-semibold text-hs-text">{total}</p>
        </div>
        <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
            Breakdown
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {SEVERITY_ORDER.map((sev) => (
              <div key={sev} className="flex items-center gap-2">
                <SeverityBadge severity={sev} />
                <span className="text-hs-secondary font-medium text-hs-muted">
                  {grouped[sev].length}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-hs-card border border-hs-success-border bg-hs-success-bg p-8 text-center">
          <p className="text-hs-section font-medium text-hs-success">
            No PHI leaks detected
          </p>
          <p className="mt-2 text-hs-body font-normal text-hs-muted">
            We scanned this repository and found no compliance violations.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {SEVERITY_ORDER.map((sev) => {
            const items = grouped[sev];
            if (items.length === 0) return null;
            return (
              <section key={sev} className="space-y-3">
                <div className="flex items-center gap-3">
                  <SeverityBadge severity={sev} />
                  <span className="text-hs-body font-normal text-hs-muted">
                    {items.length} finding{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="space-y-3">
                  {items.map((f, i) => (
                    <li key={f.id ?? `${f.source}:${f.line_number ?? "_"}:${i}`}>
                      <FindingCard finding={f} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FindingCard({ finding }: { finding: PhiFinding }) {
  return (
    <div className="rounded-hs-card border border-hs-border bg-hs-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <span className="font-mono text-hs-secondary text-hs-text">
          {finding.source}
        </span>
        {finding.line_number != null && (
          <>
            <span className="text-hs-caption text-hs-placeholder">·</span>
            <span className="font-mono text-hs-caption text-hs-muted">
              line {finding.line_number}
            </span>
          </>
        )}
      </div>

      {finding.title && (
        <p className="mt-3 text-hs-body font-medium text-hs-text">
          {finding.title}
        </p>
      )}

      <pre className="mt-3 overflow-x-auto rounded-hs border border-hs-border bg-hs-fill px-3 py-2 font-mono text-hs-caption text-hs-text">
        <code>
          {finding.line_number != null && (
            <span className="select-none pr-3 text-hs-placeholder">
              {finding.line_number}
            </span>
          )}
          {finding.evidence}
        </code>
      </pre>

      {finding.description && (
        <p className="mt-3 text-hs-body font-normal text-hs-muted">
          {finding.description}
        </p>
      )}

      {finding.recommendation && (
        <div className="mt-3 rounded-hs border border-hs-border bg-hs-fill px-3 py-2">
          <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
            Recommendation
          </p>
          <p className="mt-1 text-hs-body font-normal text-hs-text">
            {finding.recommendation}
          </p>
        </div>
      )}

      {finding.hipaa_reference && (
        <p className="mt-3 font-mono text-hs-caption text-hs-muted">
          HIPAA: <span className="text-hs-text">{finding.hipaa_reference}</span>
        </p>
      )}
    </div>
  );
}
