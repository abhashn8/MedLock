"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import type { Finding, Scan } from "@/lib/api/types";
import { HsSeverityBadge } from "@/components/hipaa-shield/HsSeverityBadge";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { cn } from "@/lib/utils";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; scan: Scan };

const SEVERITY_ORDER: Finding["severity"][] = ["CRITICAL", "HIGH", "MEDIUM"];

function computeScore(findings: Finding[]): number {
  let penalty = 0;
  for (const f of findings) {
    if (f.severity === "CRITICAL") penalty += 10;
    else if (f.severity === "HIGH") penalty += 5;
    else penalty += 2;
  }
  return Math.max(0, 100 - penalty);
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-hs-success";
  if (score >= 50) return "text-hs-warning";
  return "text-hs-danger";
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
    const buckets: Record<Finding["severity"], Finding[]> = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
    };
    for (const f of state.scan.findings ?? []) {
      buckets[f.severity].push(f);
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
  grouped: Record<Finding["severity"], Finding[]>;
}) {
  const findings = scan.findings ?? [];
  const total = findings.length;
  const score = computeScore(findings);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
          {scan.repo_owner} / {scan.repo_name}
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
                <HsSeverityBadge severity={sev} />
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
            We scanned this repository and found no risky sinks handling PHI data.
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
                  <HsSeverityBadge severity={sev} />
                  <span className="text-hs-body font-normal text-hs-muted">
                    {items.length} finding{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="space-y-3">
                  {items.map((f, i) => (
                    <li key={`${f.filePath}:${f.line}:${f.phiField}:${i}`}>
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

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className="rounded-hs-card border border-hs-border bg-hs-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <HsSeverityBadge severity={finding.severity} />
        <span className="font-mono text-hs-secondary text-hs-text">
          {finding.filePath}
        </span>
        <span className="text-hs-caption text-hs-placeholder">·</span>
        <span className="font-mono text-hs-caption text-hs-muted">
          line {finding.line}
        </span>
      </div>

      <pre className="mt-3 overflow-x-auto rounded-hs border border-hs-border bg-hs-fill px-3 py-2 font-mono text-hs-caption text-hs-text">
        <code>
          <span className="select-none pr-3 text-hs-placeholder">
            {finding.line}
          </span>
          {finding.lineContent}
        </code>
      </pre>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-hs-caption text-hs-text">
        <div>
          <span className="text-hs-muted">PHI field: </span>
          <span>{finding.phiField}</span>
        </div>
        <div>
          <span className="text-hs-muted">Sink: </span>
          <span>{finding.sink}</span>
        </div>
      </div>
    </div>
  );
}
