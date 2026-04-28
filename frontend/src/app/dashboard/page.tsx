"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { Repo, ScanSummary } from "@/lib/api/types";
import { createClient } from "@/lib/supabase/client";
import { HsAlertBanner } from "@/components/hipaa-shield/HsAlertBanner";
import { HsComplianceScoreRing } from "@/components/hipaa-shield/HsComplianceScoreRing";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import type { HsFindingRow } from "@/components/hipaa-shield/HsFindingsTable";
import { HsFindingsTable } from "@/components/hipaa-shield/HsFindingsTable";
import { HsMetricCard } from "@/components/hipaa-shield/HsMetricCard";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsReadOnlyBanner } from "@/components/hipaa-shield/HsReadOnlyBanner";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { useDashboardRbac } from "@/lib/rbac/context";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type State =
  | { kind: "loading" }
  | { kind: "needs_connection" }
  | { kind: "ready"; repos: Repo[] }
  | { kind: "error"; message: string };

export default function DashboardPage() {
  const supabase = createClient();
  const rbac = useDashboardRbac();
  const canAccessPhiScanner = rbac.canAccessPage("phi_leakage_scanner");

  const [state, setState] = useState<State>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [recentScans, setRecentScans] = useState<ScanSummary[]>([]);
  const [showAlert, setShowAlert] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!canAccessPhiScanner) return;
      const res = await apiFetch("/api/scans");
      if (!res.ok) return;
      const data = (await res.json()) as ScanSummary[];
      if (cancelled) return;
      setRecentScans(data);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [canAccessPhiScanner]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!canAccessPhiScanner) {
        setState({ kind: "ready", repos: [] });
        return;
      }
      const res = await apiFetch("/api/repos");
      const data = await res.json();
      if (cancelled) return;

      if (res.status === 404 && data?.error === "no_github_connection") {
        setState({ kind: "needs_connection" });
        return;
      }

      if (!res.ok) {
        setState({
          kind: "error",
          message:
            typeof data?.message === "string"
              ? data.message
              : "Failed to load repositories.",
        });
        return;
      }

      setState({ kind: "ready", repos: data as Repo[] });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [canAccessPhiScanner]);

  async function handleConnectGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
        scopes: "repo",
      },
    });
  }

  const filteredRepos = useMemo(() => {
    if (state.kind !== "ready") return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.repos;
    return state.repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false),
    );
  }, [state, query]);

  const scanByRepo = useMemo(() => {
    const map = new Map<string, ScanSummary>();
    for (const scan of recentScans) {
      const key = `${scan.repo_owner}/${scan.repo_name}`;
      if (!map.has(key)) map.set(key, scan);
    }
    return map;
  }, [recentScans]);

  const findingRows: HsFindingRow[] = useMemo(() => {
    return recentScans.slice(0, 8).map((scan) => ({
      id: scan.id,
      title: `${scan.repo_owner}/${scan.repo_name}`,
      description: `Repository scan · ${scan.finding_count} finding${scan.finding_count === 1 ? "" : "s"}`,
      severity:
        scan.finding_count > 5
          ? "HIGH"
          : scan.finding_count > 0
            ? "MEDIUM"
            : "LOW",
      module: "PHI Scanner",
      ownerName: "Unassigned",
      ownerInitials: "—",
      dueDate: formatDue(scan.created_at),
      overdue: false,
      status: "PENDING",
      statusLabel: "Pending review",
    }));
  }, [recentScans]);

  const complianceScore = useMemo(() => {
    if (recentScans.length === 0) return 88;
    const avgFindings =
      recentScans.reduce((a, s) => a + s.finding_count, 0) /
      Math.max(1, recentScans.length);
    return Math.max(55, Math.min(95, Math.round(92 - avgFindings * 3)));
  }, [recentScans]);

  return (
    <div className="min-h-full bg-hs-page">
      {rbac.permissionFor("dashboard") === "read_only" ? <HsReadOnlyBanner /> : null}
      {showAlert ? (
        <HsAlertBanner
          variant="CRITICAL"
          onDismiss={() => setShowAlert(false)}
        >
          <span className="font-medium text-hs-danger">Critical:</span>{" "}
          <span>
            3 overdue access reviews and 1 expired vendor BAA require action this
            week.
          </span>
        </HsAlertBanner>
      ) : null}

      <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 md:px-8">
        <section className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <HsMetricCard
              label="Open findings"
              value={String(recentScans.reduce((a, s) => a + s.finding_count, 0))}
              context="Across active repositories"
              trendPercent={12}
              trendPositive={false}
            />
            <HsMetricCard
              label="Training compliance"
              value="94%"
              context="Workforce due within 30 days"
              trendPercent={4}
              trendPositive
            />
            <HsMetricCard
              label="Active BAAs"
              value="18"
              context="2 expiring in 60 days"
              trendPercent={2}
              trendPositive={false}
            />
            <HsMetricCard
              label="Controls passing"
              value="61 / 75"
              context="HIPAA implementation specs"
              trendPercent={6}
              trendPositive
            />
          </div>
          <div className="flex justify-center rounded-hs-card border border-hs-border bg-hs-card p-6">
            <HsComplianceScoreRing score={complianceScore} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-hs-section font-semibold text-hs-text">
              Recent findings
            </h2>
            <Link
              href="/dashboard/findings-remediation"
              className="text-hs-secondary font-medium text-hs-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="rounded-hs-card border border-hs-border bg-hs-card">
            <HsFindingsTable rows={findingRows} />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-hs-section font-semibold text-hs-text">
            PHI Leakage Scanner
          </h2>
          <p className="text-hs-body font-normal text-hs-muted">
            Connect GitHub and scan repositories for risky PHI sinks.
          </p>

          {state.kind === "loading" && (
            <div className="space-y-3" aria-busy>
              <HsSkeleton className="h-10 w-full max-w-md" />
              <HsSkeleton className="h-32 w-full" />
            </div>
          )}

          {state.kind === "needs_connection" && (
            <div className="rounded-hs-card border border-hs-border bg-hs-card p-8">
              <HsEmptyState
                title="Connect GitHub"
                description="Authorize MedLock to read repository metadata and contents for PHI leakage scans."
                actionLabel="Connect GitHub"
                onAction={handleConnectGitHub}
              />
            </div>
          )}

          {state.kind === "error" && (
            <div
              className="border-l-4 border-hs-danger bg-hs-danger-bg px-6 py-4 text-hs-body text-hs-text"
              role="alert"
            >
              <span className="font-medium text-hs-danger">Error:</span> {state.message}
            </div>
          )}

          {state.kind === "ready" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="text-hs-body font-medium text-hs-text">Repositories</h3>
                  <p className="text-hs-secondary text-hs-muted">
                    {state.repos.length} repos · recently updated
                  </p>
                </div>
                <div className="w-full max-w-xs">
                  <HsTextInput
                    label="Filter"
                    placeholder="Search repositories…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>

              {recentScans.length > 0 && (
                <div className="rounded-hs-card border border-hs-border bg-hs-card">
                  <ul className="divide-y divide-hs-fill">
                    {recentScans.slice(0, 5).map((scan) => (
                      <li
                        key={scan.id}
                        className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-hs-secondary font-medium text-hs-text">
                            {scan.repo_owner}/{scan.repo_name}
                          </p>
                          <p className="text-hs-caption text-hs-muted">
                            {scan.finding_count} finding
                            {scan.finding_count === 1 ? "" : "s"} ·{" "}
                            {timeAgo(scan.created_at)}
                          </p>
                        </div>
                        <Link
                          href={`/dashboard/report/${scan.id}`}
                          className="text-hs-secondary font-medium text-hs-primary hover:underline"
                        >
                          View report
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {filteredRepos.length === 0 ? (
                <p className="rounded-hs-card border border-hs-border bg-hs-card px-4 py-8 text-center text-hs-body text-hs-muted">
                  No repositories match &ldquo;{query}&rdquo;.
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {filteredRepos.map((repo) => (
                    <li key={repo.id}>
                      <RepoCard
                        repo={repo}
                        lastScan={scanByRepo.get(repo.full_name)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RepoCard({
  repo,
  lastScan,
}: {
  repo: Repo;
  lastScan?: ScanSummary;
}) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    setScanning(true);
    setError(null);
    try {
      const res = await apiFetch("/api/scans", {
        method: "POST",
        body: JSON.stringify({
          owner: repo.owner.login,
          repo: repo.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Scan failed.");
        setScanning(false);
        return;
      }
      router.push(`/dashboard/report/${data.scanId}`);
    } catch {
      setError("Scan failed.");
      setScanning(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-hs-card border border-hs-border bg-hs-card p-6 hs-transition-border hover:border-hs-border-strong">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-hs-secondary font-medium text-hs-text">
            {repo.name}
          </h3>
          <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-2 py-0.5 text-hs-caption font-medium text-hs-muted">
            {repo.private ? "Private" : "Public"}
          </span>
        </div>
        <p className="line-clamp-2 text-hs-caption text-hs-muted">
          {repo.description ?? "No description"}
        </p>
        {lastScan && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-hs-caption text-hs-muted">
            <span>
              {lastScan.finding_count} finding
              {lastScan.finding_count === 1 ? "" : "s"}
            </span>
            <span>· {timeAgo(lastScan.created_at)}</span>
            <Link
              href={`/dashboard/report/${lastScan.id}`}
              className="font-medium text-hs-primary hover:underline"
            >
              Last report
            </Link>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <HsPrimaryButton
          type="button"
          className="w-full"
          onClick={handleScan}
          disabled={scanning}
          loading={scanning}
        >
          Scan this repo
        </HsPrimaryButton>
        {error ? <p className="text-hs-caption text-hs-danger">{error}</p> : null}
      </div>
    </div>
  );
}
