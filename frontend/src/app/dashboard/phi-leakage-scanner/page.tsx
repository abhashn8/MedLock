"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { PhiFinding, PhiScanOverview, Repo } from "@/lib/api/types";
import { exportFindingsCsv, exportFindingsPdf, exportFindingsXlsx } from "@/lib/phi-scan-export";
import { createClient } from "@/lib/supabase/client";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import { HsModal } from "@/components/hipaa-shield/HsModal";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsReadOnlyBanner } from "@/components/hipaa-shield/HsReadOnlyBanner";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { HsTextarea } from "@/components/hipaa-shield/HsTextarea";
import { useDashboardRbac } from "@/lib/rbac/context";

const OWNER_OPTIONS = [
  "Security Officer",
  "Privacy Officer",
  "Compliance Manager",
  "Engineering Lead",
  "DevSecOps",
];

function formatScanTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function severityStyle(severity: PhiFinding["severity"]): string {
  if (severity === "Critical") return "border-hs-danger-border bg-hs-danger-bg text-hs-danger";
  if (severity === "High") return "border-hs-warning-border bg-hs-warning-bg text-hs-warning";
  if (severity === "Medium") return "border-hs-info-border bg-hs-info-bg text-hs-primary";
  return "border-hs-border bg-hs-fill text-hs-muted";
}

/** Open vs closed-style workflow label for the Status column. */
function findingStatusMain(status: PhiFinding["status"]): string {
  if (status === "open") return "Open";
  if (status === "resolved") return "Closed";
  return "False positive";
}

function FindingIssueBody({ finding, size = "compact" }: { finding: PhiFinding; size?: "compact" | "comfortable" }) {
  const body = size === "comfortable" ? "text-hs-body" : "text-hs-caption";
  if (finding.description?.trim()) {
    return (
      <div className="space-y-2">
        {finding.title?.trim() ? (
          <p className={`font-medium text-hs-text [overflow-wrap:anywhere] ${body}`}>{finding.title}</p>
        ) : null}
        <p className={`whitespace-pre-wrap text-hs-secondary [overflow-wrap:anywhere] ${body}`}>{finding.description}</p>
      </div>
    );
  }
  if (finding.title?.trim()) {
    return (
      <p className={`whitespace-pre-wrap font-medium text-hs-text [overflow-wrap:anywhere] ${body}`}>{finding.title}</p>
    );
  }
  return <p className={`text-hs-muted ${body}`}>No issue summary was recorded for this finding.</p>;
}

/** Long text in a fixed-width table cell: bounded height + vertical scroll, no horizontal spill. */
function ScrollCell({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div
      title={title}
      className="max-h-48 w-full min-w-0 overflow-y-auto overflow-x-hidden break-words rounded-md border border-hs-border bg-hs-fill/40 p-2 text-hs-caption leading-snug text-hs-text [overflow-wrap:anywhere]"
    >
      {children}
    </div>
  );
}

export default function PhiLeakageScannerPage() {
  const supabase = createClient();
  const rbac = useDashboardRbac();
  const canWrite = rbac.canWritePage("phi_leakage_scanner");
  const [overview, setOverview] = useState<PhiScanOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState("");
  const selectedScanIdRef = useRef("");

  const [repos, setRepos] = useState<Repo[]>([]);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [repoQuery, setRepoQuery] = useState("");
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);

  const [falsePositiveFinding, setFalsePositiveFinding] = useState<PhiFinding | null>(null);
  const [falsePositiveReason, setFalsePositiveReason] = useState("");
  const [takeActionFinding, setTakeActionFinding] = useState<PhiFinding | null>(null);
  const [remediationFinding, setRemediationFinding] = useState<PhiFinding | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPdfLoading, setExportPdfLoading] = useState(false);

  async function loadGitHubRepos() {
    const res = await apiFetch("/api/repos");
    const data = await res.json();
    if (res.status === 404 && data?.error === "no_github_connection") {
      setGithubConnected(false);
      setRepos([]);
      setSelectedRepos([]);
      return;
    }
    if (!res.ok) {
      setError(typeof data?.message === "string" ? data.message : "Failed to load repositories.");
      return;
    }
    const repoData = data as Repo[];
    setGithubConnected(true);
    setRepos(repoData);
    if (selectedRepos.length === 0 && repoData.length > 0) {
      setSelectedRepos([repoData[0].full_name]);
    }
  }

  async function handleConnectGitHub() {
    if (!canWrite) return;
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
        scopes: "repo",
      },
    });
  }

  async function handleDisconnectGitHub() {
    if (!canWrite) return;
    const res = await apiFetch("/api/repos/connection", { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to disconnect GitHub.");
      return;
    }
    setRepos([]);
    setSelectedRepos([]);
    setGithubConnected(false);
  }

  useEffect(() => {
    selectedScanIdRef.current = selectedScanId;
  }, [selectedScanId]);

  async function fetchOverview(scanId?: string): Promise<PhiScanOverview> {
    const params = new URLSearchParams();
    if (scanId) params.set("scan_id", scanId);
    const qs = params.toString();
    const res = await apiFetch(qs ? `/api/phi-scan?${qs}` : "/api/phi-scan");
    const data = (await res.json()) as PhiScanOverview | { message?: string };
    if (!res.ok) {
      const message =
        typeof (data as { message?: string }).message === "string"
          ? (data as { message?: string }).message!
          : "Failed to load scanner data.";
      throw new Error(message);
    }
    return data as PhiScanOverview;
  }

  /** Loads scans + findings for the current or given scan. Pass scanId to switch selection after load. */
  async function loadOverview(scanId?: string) {
    setError(null);
    const explicit = scanId;
    const fromRef = selectedScanIdRef.current;

    try {
      if (!explicit && !fromRef) {
        const initial = await fetchOverview(undefined);
        const firstId = initial.scans[0]?.id;
        if (firstId) {
          setSelectedScanId(firstId);
          selectedScanIdRef.current = firstId;
          const narrowed = await fetchOverview(firstId);
          setOverview(narrowed);
        } else {
          setSelectedScanId("");
          selectedScanIdRef.current = "";
          setOverview(initial);
        }
        return;
      }

      const idToFetch = explicit ?? fromRef;
      const data = await fetchOverview(idToFetch || undefined);
      setOverview(data);
      if (explicit) {
        setSelectedScanId(explicit);
        selectedScanIdRef.current = explicit;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scanner data.");
    }
  }

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    loadOverview()
      .catch(() => {
        if (!ignore) setError("Failed to load scanner data.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadGitHubRepos().catch(() => {
      setError("Failed to load repositories.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) return;
    const handle = setInterval(() => {
      loadOverview().catch(() => {});
    }, 1500);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const activeScan = useMemo(() => {
    if (!overview?.scans?.length) return null;
    return overview.scans.find((scan) => scan.status === "running" || scan.status === "pending") ?? null;
  }, [overview]);

  const selectedScan = useMemo(() => {
    if (!overview?.scans?.length || !selectedScanId) return null;
    return overview.scans.find((s) => s.id === selectedScanId) ?? null;
  }, [overview, selectedScanId]);

  const filteredRepos = useMemo(() => {
    const q = repoQuery.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (repo) =>
        repo.full_name.toLowerCase().includes(q) ||
        repo.name.toLowerCase().includes(q) ||
        (repo.description?.toLowerCase().includes(q) ?? false),
    );
  }, [repoQuery, repos]);

  async function runScan() {
    if (!canWrite) return;
    setError(null);
    setRunning(true);
    try {
      if (selectedRepos.length === 0) {
        setError("Select at least one GitHub repository.");
        setRunning(false);
        return;
      }
      for (const repo of selectedRepos) {
        const res = await apiFetch("/api/phi-scan", {
          method: "POST",
          body: JSON.stringify({
            sourceType: "github",
            repoUrl: `https://github.com/${repo}`,
          }),
        });
        const data = (await res.json()) as { message?: string; scanId?: string };
        if (!res.ok) {
          setError(typeof data?.message === "string" ? data.message : `Scan failed for ${repo}.`);
          setRunning(false);
          return;
        }
        if (typeof data?.scanId === "string") {
          await apiFetch("/api/phi-inventory/sync-from-scanner", {
            method: "POST",
            body: JSON.stringify({ scan_id: data.scanId }),
          }).catch(() => {});
        }
      }
      setSelectedScanId("");
      selectedScanIdRef.current = "";
      await loadOverview();
    } catch {
      setError("Scan failed.");
    } finally {
      setRunning(false);
    }
  }

  async function patchFinding(id: string, payload: Record<string, unknown>) {
    if (!canWrite) return;
    const res = await apiFetch(`/api/phi-scan/findings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data?.message === "string" ? data.message : "Update failed.");
    }
    await loadOverview();
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto min-w-0 max-w-[1240px] space-y-8">
        {rbac.permissionFor("phi_leakage_scanner") === "read_only" ? <HsReadOnlyBanner /> : null}
        <section>
          <h1 className="text-hs-title font-semibold text-hs-text">PHI Leakage Scanner</h1>
          <p className="mt-2 text-hs-body text-hs-muted">
            Connect source content, scan for PHI/security exposure, and triage findings.
          </p>
        </section>

        {error ? (
          <div className="border-l-4 border-hs-danger bg-hs-danger-bg px-6 py-4 text-hs-body text-hs-text">
            <span className="font-medium text-hs-danger">Error:</span> {error}
          </div>
        ) : null}

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-hs-section font-semibold text-hs-text">GitHub connection</h2>
              {githubConnected === null ? (
                <p className="text-hs-secondary text-hs-muted">Checking connection...</p>
              ) : githubConnected ? (
                <p className="text-hs-secondary text-hs-muted">
                  Connected to GitHub · {repos.length} repositories available.
                </p>
              ) : (
                <p className="text-hs-secondary text-hs-muted">
                  Not connected. Authorize GitHub to scan repositories.
                </p>
              )}
            </div>
            {canWrite ? (
              <div className="flex gap-2">
                {githubConnected ? (
                  <HsPrimaryButton type="button" onClick={handleConnectGitHub}>
                    Switch GitHub
                  </HsPrimaryButton>
                ) : (
                  <HsPrimaryButton type="button" onClick={handleConnectGitHub}>
                    Login with GitHub
                  </HsPrimaryButton>
                )}
                <HsSecondaryButton type="button" onClick={handleDisconnectGitHub}>
                  Disconnect
                </HsSecondaryButton>
              </div>
            ) : null}
          </div>

          {githubConnected ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div className="space-y-2">
                <p className="text-hs-secondary font-medium text-hs-text">Repositories</p>
                <p className="text-hs-caption text-hs-muted">
                  {selectedRepos.length} selected · {repos.length} repos available
                </p>
                {selectedRepos.length === 1 ? (
                  <p className="text-hs-secondary text-hs-text">
                    Selected repo: {selectedRepos[0]}
                  </p>
                ) : selectedRepos.length > 1 ? (
                  <p className="text-hs-secondary text-hs-text">
                    Selected repos: {selectedRepos[0]} +{selectedRepos.length - 1} more
                  </p>
                ) : null}
                {selectedRepos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedRepos.slice(0, 3).map((repo) => (
                      <span
                        key={repo}
                        className="rounded-hs-pill border border-hs-border bg-hs-fill px-2 py-1 text-hs-caption text-hs-text"
                      >
                        {repo}
                      </span>
                    ))}
                    {selectedRepos.length > 3 ? (
                      <span className="rounded-hs-pill border border-hs-border bg-hs-fill px-2 py-1 text-hs-caption text-hs-muted">
                        +{selectedRepos.length - 3} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-row flex-wrap gap-2 lg:max-w-[220px] lg:flex-col">
                {canWrite ? (
                  <>
                    <HsSecondaryButton type="button" onClick={() => setRepoPickerOpen(true)}>
                      Select repositories
                    </HsSecondaryButton>
                    <HsPrimaryButton
                      type="button"
                      onClick={runScan}
                      disabled={running || selectedRepos.length === 0}
                      loading={running}
                    >
                      Run Scan
                    </HsPrimaryButton>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {activeScan ? (
          <section className="rounded-hs-card border border-hs-border bg-hs-card p-4">
            <p className="text-hs-secondary text-hs-muted">
              {activeScan.source_name}: {activeScan.progress_percent}% - {activeScan.progress_message ?? "running"}
            </p>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading || !overview ? (
            Array.from({ length: 4 }).map((_, i) => <HsSkeleton key={i} className="h-[118px] w-full" />)
          ) : overview.scans.length === 0 ? (
            <>
              <MetricCard label="Total findings" value="0" />
              <MetricCard label="Critical count" value="0" />
              <MetricCard label="Sources scanned" value="0" />
              <MetricCard label="False positives" value="0" />
            </>
          ) : (
            <>
              <MetricCard label="Total findings" value={String(overview.stats.totalFindings)} />
              <MetricCard label="Critical count" value={String(overview.stats.criticalCount)} />
              <MetricCard label="Sources scanned" value={String(overview.stats.sourcesScanned)} />
              <MetricCard label="False positives" value={String(overview.stats.falsePositives)} />
            </>
          )}
        </section>

        <section className="min-w-0 rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-hs-section font-semibold text-hs-text">Scan results</h2>
              <p className="mt-1 text-hs-secondary text-hs-muted">
                Showing findings for the selected scan run. Choose another run below to compare history.
              </p>
            </div>
            <HsSecondaryButton
              type="button"
              className="shrink-0 self-start"
              disabled={loading || !overview || overview.findings.length === 0}
              onClick={() => setExportModalOpen(true)}
            >
              Export
            </HsSecondaryButton>
          </div>

          {!loading && overview && overview.scans.length > 0 ? (
            <div className="mt-5 max-w-xl">
              <HsSelect
                label="Scan run"
                value={selectedScanId}
                onChange={(e) => {
                  const id = e.target.value;
                  void loadOverview(id);
                }}
              >
                {overview.scans.map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    {scan.source_name} · {formatScanTime(scan.created_at)} · {scan.status}
                    {typeof scan.finding_count === "number" ? ` · ${scan.finding_count} findings` : ""}
                  </option>
                ))}
              </HsSelect>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-5 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <HsSkeleton key={i} className="h-[52px] w-full" rounded="none" />
              ))}
            </div>
          ) : !overview || overview.scans.length === 0 ? (
            <div className="mt-5">
              <HsEmptyState
                title="No PHI scans yet"
                description="No PHI scans yet - connect a source and run the first scan."
              />
            </div>
          ) : overview.findings.length === 0 ? (
            <div className="mt-5">
              <HsEmptyState
                title={selectedScan?.status === "running" || selectedScan?.status === "pending" ? "Scan in progress" : "No findings for this scan"}
                description={
                  selectedScan?.status === "running" || selectedScan?.status === "pending"
                    ? "Findings will appear here when the scan completes."
                    : "This run did not return any PHI findings, or results are not available yet."
                }
              />
            </div>
          ) : (
            <div className="mt-5 min-w-0 overflow-x-hidden rounded-hs border border-hs-border">
              <table className="w-full min-w-0 table-fixed border-collapse [&_td]:min-w-0 [&_th]:min-w-0">
                <thead className="sticky top-0 z-[1] border-b border-hs-fill bg-hs-page shadow-sm">
                  <tr className="h-12">
                    {(
                      [
                        ["Source", "w-[21%]"],
                        ["PHI Type", "w-[10%]"],
                        ["Severity", "w-[7%]"],
                        ["Line", "w-[3%]"],
                        ["Evidence", "w-[32%]"],
                        ["Status", "w-[14%]"],
                        ["Actions", "w-[13%]"],
                      ] as const
                    ).map(([header, w]) => (
                      <th
                        key={header}
                        className={`${w} px-3 py-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted whitespace-nowrap`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.findings.map((finding) => (
                    <tr key={finding.id} className="border-b border-hs-fill hover:bg-hs-fill-hover align-top">
                      <td className="w-[21%] min-w-0 px-3 py-2.5 align-top font-mono text-[11px] leading-snug text-hs-secondary break-words [overflow-wrap:anywhere]">
                        {finding.source}
                      </td>
                      <td className="w-[10%] min-w-0 px-3 py-2.5 align-top break-words text-hs-caption text-hs-secondary [overflow-wrap:anywhere]">
                        {finding.phi_type}
                      </td>
                      <td className="w-[7%] min-w-0 px-3 py-2.5 align-top">
                        <span
                          className={`inline-flex min-w-0 max-w-full truncate rounded-hs-pill border px-2 py-1 text-[11px] font-medium leading-none ${severityStyle(finding.severity)}`}
                          title={finding.severity}
                        >
                          {finding.severity}
                        </span>
                      </td>
                      <td className="w-[3%] min-w-0 whitespace-nowrap px-2 py-2.5 text-center align-top text-hs-caption text-hs-secondary tabular-nums">
                        {finding.line_number ?? "-"}
                      </td>
                      <td className="w-[32%] min-w-0 px-3 py-2.5 align-top">
                        <ScrollCell title={finding.evidence}>
                          <span className="whitespace-pre-wrap break-words">{finding.evidence}</span>
                        </ScrollCell>
                      </td>
                      <td className="w-[14%] min-w-0 px-3 py-2.5 align-top">
                        <div className="min-w-0 space-y-1.5 break-words text-hs-caption leading-snug">
                          <p className="font-medium text-hs-text">{findingStatusMain(finding.status)}</p>
                          {finding.owner?.trim() ? (
                            <p className="text-hs-secondary [overflow-wrap:anywhere]">
                              <span className="text-hs-muted">Assigned:</span> {finding.owner}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="w-[13%] min-w-0 px-3 py-2.5 align-middle">
                        {canWrite ? (
                          <div className="flex min-w-0 flex-col gap-1.5">
                            <HsSecondaryButton
                              type="button"
                              className="h-9 w-full shrink-0 px-2 text-hs-caption"
                              onClick={() => setTakeActionFinding(finding)}
                            >
                              Take action
                            </HsSecondaryButton>
                            <HsSecondaryButton
                              type="button"
                              className="h-9 w-full shrink-0 px-2 text-hs-caption"
                              onClick={() => setRemediationFinding(finding)}
                            >
                              Remediation
                            </HsSecondaryButton>
                          </div>
                        ) : (
                          <span className="text-hs-caption text-hs-muted">View only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <HsModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export findings"
        footer={
          <HsSecondaryButton type="button" onClick={() => setExportModalOpen(false)}>
            Close
          </HsSecondaryButton>
        }
      >
        <p className="text-hs-secondary text-hs-muted">
          Export the findings shown for the selected scan run. PDF includes the <span className="font-medium text-hs-text">MedLock</span> brand
          and scan details in the header. Excel downloads as an .xlsx spreadsheet.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <HsPrimaryButton
            type="button"
            className="w-full sm:w-auto"
            loading={exportPdfLoading}
            disabled={exportPdfLoading || !overview}
            onClick={async () => {
              if (!overview) return;
              setExportPdfLoading(true);
              setError(null);
              try {
                await exportFindingsPdf(overview.findings, selectedScan);
                setExportModalOpen(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "PDF export failed.");
              } finally {
                setExportPdfLoading(false);
              }
            }}
          >
            Download PDF
          </HsPrimaryButton>
          <HsSecondaryButton
            type="button"
            className="w-full sm:w-auto"
            disabled={!overview}
            onClick={() => {
              if (!overview) return;
              exportFindingsCsv(overview.findings, selectedScan);
              setExportModalOpen(false);
            }}
          >
            Download CSV
          </HsSecondaryButton>
          <HsSecondaryButton
            type="button"
            className="w-full sm:w-auto"
            disabled={!overview}
            onClick={async () => {
              if (!overview) return;
              try {
                await exportFindingsXlsx(overview.findings, selectedScan);
                setExportModalOpen(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Excel export failed.");
              }
            }}
          >
            Download Excel (.xlsx)
          </HsSecondaryButton>
        </div>
      </HsModal>

      <HsModal
        open={repoPickerOpen}
        onClose={() => setRepoPickerOpen(false)}
        title="Select repositories"
        footer={
          <>
            <HsSecondaryButton type="button" onClick={() => setSelectedRepos([])}>
              Clear
            </HsSecondaryButton>
            <HsSecondaryButton
              type="button"
              onClick={() => setSelectedRepos(repos.map((repo) => repo.full_name))}
            >
              Select all
            </HsSecondaryButton>
            <HsPrimaryButton type="button" onClick={() => setRepoPickerOpen(false)}>
              Done
            </HsPrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <HsTextInput
            label="Search repositories"
            value={repoQuery}
            onChange={(e) => setRepoQuery(e.target.value)}
            placeholder="Filter by name..."
          />
          <div className="max-h-72 overflow-y-auto rounded-hs border border-hs-border bg-hs-card p-2">
            {filteredRepos.length === 0 ? (
              <p className="px-2 py-2 text-hs-caption text-hs-muted">
                {repos.length === 0
                  ? "No repositories returned from GitHub."
                  : "No repositories match your filter."}
              </p>
            ) : (
              <ul className="space-y-1">
                {filteredRepos.map((repo) => {
                  const checked = selectedRepos.includes(repo.full_name);
                  return (
                    <li key={repo.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-hs px-2 py-1 hover:bg-hs-fill-hover">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedRepos((prev) =>
                              e.target.checked
                                ? [...prev, repo.full_name]
                                : prev.filter((item) => item !== repo.full_name),
                            );
                          }}
                          className="size-4"
                        />
                        <span className="truncate text-hs-secondary text-hs-text">
                          {repo.full_name}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-hs-caption text-hs-muted">
            {selectedRepos.length} selected · {repos.length} repos available
          </p>
        </div>
      </HsModal>

      <HsModal
        className="max-w-2xl"
        open={Boolean(remediationFinding)}
        onClose={() => setRemediationFinding(null)}
        title="Remediation"
        footer={
          <HsSecondaryButton type="button" onClick={() => setRemediationFinding(null)}>
            Close
          </HsSecondaryButton>
        }
      >
        {remediationFinding ? (
          <div className="max-h-[min(70vh,560px)] space-y-6 overflow-y-auto pr-1">
            <div>
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Source</p>
              <p className="mt-1 text-hs-body text-hs-text [overflow-wrap:anywhere]">{remediationFinding.source}</p>
              {remediationFinding.line_number != null ? (
                <p className="mt-1 text-hs-caption text-hs-muted">Line {remediationFinding.line_number}</p>
              ) : null}
            </div>
            <div className="rounded-hs border border-hs-border bg-hs-fill/30 p-4">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">{"What's wrong"}</p>
              <div className="mt-3">
                <FindingIssueBody finding={remediationFinding} size="comfortable" />
              </div>
            </div>
            <div className="rounded-hs border border-hs-border bg-hs-fill/30 p-4">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">How to fix</p>
              <p className="mt-3 whitespace-pre-wrap text-hs-body text-hs-secondary [overflow-wrap:anywhere]">
                {remediationFinding.recommendation}
              </p>
            </div>
          </div>
        ) : null}
      </HsModal>

      <HsModal
        open={Boolean(takeActionFinding)}
        onClose={() => setTakeActionFinding(null)}
        title="Take action"
        footer={
          <HsSecondaryButton type="button" onClick={() => setTakeActionFinding(null)}>
            Close
          </HsSecondaryButton>
        }
      >
        {takeActionFinding ? (
          <div className="space-y-5">
            <div>
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Source</p>
              <p className="mt-1 text-hs-body text-hs-text [overflow-wrap:anywhere]">{takeActionFinding.source}</p>
              {takeActionFinding.line_number != null ? (
                <p className="mt-1 text-hs-caption text-hs-muted">Line {takeActionFinding.line_number}</p>
              ) : null}
            </div>
            <div className="rounded-hs border border-hs-border bg-hs-fill/30 p-4">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Owner</p>
              <p className="mt-1 text-hs-body font-medium text-hs-text">
                {takeActionFinding.owner?.trim() ? takeActionFinding.owner : "Unassigned"}
              </p>
              <p className="mt-2 text-hs-caption text-hs-muted">Status: {findingStatusMain(takeActionFinding.status)}</p>
            </div>
            <div>
              <p className="mb-2 text-hs-caption font-medium text-hs-muted">Assign owner</p>
              <OwnerAssign
                key={takeActionFinding.id}
                finding={takeActionFinding}
                onAssign={async (owner) => {
                  try {
                    await patchFinding(takeActionFinding.id, { action: "assign_owner", owner });
                    setTakeActionFinding(null);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Update failed.");
                  }
                }}
              />
            </div>
            <div className="space-y-2 border-t border-hs-border pt-4">
              <p className="text-hs-caption font-medium text-hs-muted">Other actions</p>
              <HsSecondaryButton
                type="button"
                className="w-full"
                onClick={() => {
                  const f = takeActionFinding;
                  setTakeActionFinding(null);
                  setFalsePositiveFinding(f);
                  setFalsePositiveReason("");
                }}
              >
                Mark false positive
              </HsSecondaryButton>
              <HsSecondaryButton
                type="button"
                className="w-full"
                onClick={async () => {
                  try {
                    await patchFinding(takeActionFinding.id, { action: "resolve" });
                    setTakeActionFinding(null);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to resolve.");
                  }
                }}
              >
                Resolve
              </HsSecondaryButton>
            </div>
          </div>
        ) : null}
      </HsModal>

      <HsModal
        open={Boolean(falsePositiveFinding)}
        onClose={() => setFalsePositiveFinding(null)}
        title="Mark false positive"
        footer={
          <>
            <HsSecondaryButton type="button" onClick={() => setFalsePositiveFinding(null)}>
              Cancel
            </HsSecondaryButton>
            <HsPrimaryButton
              type="button"
              onClick={async () => {
                if (!falsePositiveFinding) return;
                try {
                  await patchFinding(falsePositiveFinding.id, {
                    action: "false_positive",
                    reason: falsePositiveReason,
                  });
                  setFalsePositiveFinding(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to update finding.");
                }
              }}
            >
              Confirm
            </HsPrimaryButton>
          </>
        }
      >
        <HsTextarea
          label="Reason"
          placeholder="Explain why this is not a real issue."
          value={falsePositiveReason}
          onChange={(e) => setFalsePositiveReason(e.target.value)}
        />
      </HsModal>
    </div>
  );
}

function OwnerAssign({
  finding,
  onAssign,
}: {
  finding: PhiFinding;
  onAssign: (owner: string) => Promise<void>;
}) {
  const [owner, setOwner] = useState(finding.owner ?? OWNER_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <select
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        className="h-8 w-full min-w-0 rounded-hs border border-hs-border bg-hs-card px-2 text-hs-caption text-hs-text"
      >
        {OWNER_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <HsSecondaryButton
        type="button"
        className="h-8 w-full shrink-0 px-2 text-hs-caption"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onAssign(owner);
          } finally {
            setSaving(false);
          }
        }}
      >
        Assign owner
      </HsSecondaryButton>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
      <p className="text-hs-secondary text-hs-muted">{label}</p>
      <p className="mt-2 text-hs-metric font-semibold text-hs-text">{value}</p>
    </div>
  );
}
