"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Finding } from "@medlock/phi-detector";

type Scan = {
  id: string;
  repo_owner: string;
  repo_name: string;
  findings: Finding[];
  created_at: string;
};

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; scan: Scan };

const SEVERITY_ORDER: Finding["severity"][] = ["CRITICAL", "HIGH", "MEDIUM"];

const SEVERITY_STYLES: Record<
  Finding["severity"],
  { badge: string; border: string; label: string }
> = {
  CRITICAL: {
    badge:
      "bg-red-500/15 text-red-400 border border-red-500/30",
    border: "border-red-500/30",
    label: "Critical",
  },
  HIGH: {
    badge:
      "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    border: "border-orange-500/30",
    label: "High",
  },
  MEDIUM: {
    badge:
      "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    border: "border-yellow-500/30",
    label: "Medium",
  },
};

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
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

export default function ReportPage() {
  const params = useParams<{ scanId: string }>();
  const scanId = params.scanId;
  const supabase = createClient();

  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("scans")
        .select("id, repo_owner, repo_name, findings, created_at")
        .eq("id", scanId)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setState({
          kind: "error",
          message: error?.message ?? "Scan not found.",
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
    <div className="min-h-screen bg-background">
      <header className="border-border border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Medlock
            </span>
            <span className="text-muted-foreground text-xs">/</span>
            <Link
              href="/dashboard"
              className="font-medium text-muted-foreground text-sm hover:text-foreground"
            >
              Dashboard
            </Link>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="font-medium text-foreground text-sm">Report</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        {state.kind === "loading" && (
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
            Loading scan report...
          </div>
        )}

        {state.kind === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm">
            {state.message}
          </div>
        )}

        {state.kind === "ready" && grouped && (
          <ReportBody scan={state.scan} grouped={grouped} />
        )}
      </main>
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
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
          {scan.repo_owner} / {scan.repo_name}
        </p>
        <h1 className="font-medium text-2xl text-foreground tracking-tight">
          PHI Scan Report
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="font-mono text-muted-foreground text-[11px] uppercase tracking-wider">
            Safety Score
          </p>
          <p className={`mt-2 font-medium text-4xl ${scoreColor(score)}`}>
            {score}
            <span className="text-muted-foreground text-xl">/100</span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="font-mono text-muted-foreground text-[11px] uppercase tracking-wider">
            Total Findings
          </p>
          <p className="mt-2 font-medium text-4xl text-foreground">{total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="font-mono text-muted-foreground text-[11px] uppercase tracking-wider">
            Breakdown
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SEVERITY_ORDER.map((sev) => (
              <span
                key={sev}
                className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${SEVERITY_STYLES[sev].badge}`}
              >
                {SEVERITY_STYLES[sev].label} {grouped[sev].length}
              </span>
            ))}
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
          <p className="font-medium text-emerald-400 text-lg">
            No PHI leaks detected
          </p>
          <p className="mt-2 text-emerald-400/70 text-sm">
            We scanned this repository and found no risky sinks handling PHI
            data.
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
                  <span
                    className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${SEVERITY_STYLES[sev].badge}`}
                  >
                    {SEVERITY_STYLES[sev].label}
                  </span>
                  <span className="text-muted-foreground text-sm">
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
  const styles = SEVERITY_STYLES[finding.severity];
  return (
    <div
      className={`rounded-lg border bg-card p-4 ${styles.border}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${styles.badge}`}
        >
          {styles.label}
        </span>
        <span className="font-mono text-foreground text-xs">
          {finding.filePath}
        </span>
        <span className="text-muted-foreground text-xs">·</span>
        <span className="font-mono text-muted-foreground text-xs">
          line {finding.line}
        </span>
      </div>

      <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-foreground text-xs">
        <code>
          <span className="select-none pr-3 text-muted-foreground">
            {finding.line}
          </span>
          {finding.lineContent}
        </code>
      </pre>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs">
        <div>
          <span className="text-muted-foreground">PHI field: </span>
          <span className="text-foreground">{finding.phiField}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Sink: </span>
          <span className="text-foreground">{finding.sink}</span>
        </div>
      </div>
    </div>
  );
}
