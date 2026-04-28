"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { PhiFinding, PhiScanOverview, Repo } from "@/lib/api/types";
import { createClient } from "@/lib/supabase/client";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import { HsModal } from "@/components/hipaa-shield/HsModal";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { HsTextarea } from "@/components/hipaa-shield/HsTextarea";

type SourceMode = "github" | "upload";

const OWNER_OPTIONS = [
  "Security Officer",
  "Privacy Officer",
  "Compliance Manager",
  "Engineering Lead",
  "DevSecOps",
];

function severityStyle(severity: PhiFinding["severity"]): string {
  if (severity === "Critical") return "border-hs-danger-border bg-hs-danger-bg text-hs-danger";
  if (severity === "High") return "border-[#FDE68A] bg-hs-warning-bg text-hs-warning";
  if (severity === "Medium") return "border-[#BFDBFE] bg-hs-info-bg text-hs-primary";
  return "border-hs-border bg-hs-fill text-hs-muted";
}

export default function PhiLeakageScannerPage() {
  const supabase = createClient();
  const [overview, setOverview] = useState<PhiScanOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [sourceMode, setSourceMode] = useState<SourceMode>("github");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSource, setFilterSource] = useState("");

  const [scheduleSource, setScheduleSource] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const [falsePositiveFinding, setFalsePositiveFinding] = useState<PhiFinding | null>(null);
  const [falsePositiveReason, setFalsePositiveReason] = useState("");

  async function loadGitHubRepos() {
    if (sourceMode !== "github") return;
    const res = await apiFetch("/api/repos");
    const data = await res.json();
    if (res.status === 404 && data?.error === "no_github_connection") {
      setGithubConnected(false);
      setRepos([]);
      setSelectedRepo("");
      return;
    }
    if (!res.ok) {
      setError(typeof data?.message === "string" ? data.message : "Failed to load repositories.");
      return;
    }
    const repoData = data as Repo[];
    setGithubConnected(true);
    setRepos(repoData);
    if (!selectedRepo && repoData.length > 0) {
      setSelectedRepo(repoData[0].full_name);
    }
  }

  async function handleConnectGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
        scopes: "repo",
      },
    });
  }

  async function loadOverview() {
    setError(null);
    const query = new URLSearchParams();
    if (filterSeverity) query.set("severity", filterSeverity);
    if (filterType) query.set("phi_type", filterType);
    if (filterStatus) query.set("status", filterStatus);
    if (filterSource) query.set("source", filterSource);

    const res = await apiFetch(`/api/phi-scan${query.toString() ? `?${query.toString()}` : ""}`);
    const data = (await res.json()) as PhiScanOverview | { message?: string };
    if (!res.ok) {
      setError(typeof (data as { message?: string }).message === "string" ? (data as { message?: string }).message! : "Failed to load scanner data.");
      return;
    }
    setOverview(data as PhiScanOverview);
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
  }, [filterSeverity, filterType, filterStatus, filterSource]);

  useEffect(() => {
    loadGitHubRepos().catch(() => {
      setError("Failed to load repositories.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceMode]);

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

  async function runScan() {
    setError(null);
    setRunning(true);
    try {
      let body: Record<string, unknown>;
      if (sourceMode === "github") {
        if (!selectedRepo) {
          setError("Select a GitHub repository first.");
          setRunning(false);
          return;
        }
        body = { sourceType: "github", repoUrl: `https://github.com/${selectedRepo}` };
      } else {
        if (!uploadFile) {
          setError("Select a file before running upload scan.");
          setRunning(false);
          return;
        }
        body = {
          sourceType: "upload",
          fileName: uploadFile.name,
          fileContent: await uploadFile.text(),
        };
      }

      const res = await apiFetch("/api/phi-scan", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.message === "string" ? data.message : "Scan failed.");
        setRunning(false);
        return;
      }
      await loadOverview();
    } catch {
      setError("Scan failed.");
    } finally {
      setRunning(false);
    }
  }

  async function patchFinding(id: string, payload: Record<string, unknown>) {
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

  async function saveSchedule() {
    if (!scheduleSource.trim()) {
      setError("Source is required for schedule.");
      return;
    }
    setScheduleSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/phi-scan/schedule", {
        method: "POST",
        body: JSON.stringify({
          source: scheduleSource.trim(),
          frequency: scheduleFrequency,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.message === "string" ? data.message : "Failed to save schedule.");
        return;
      }
      setScheduleSource("");
    } finally {
      setScheduleSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1240px] space-y-8">
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading || !overview ? (
            Array.from({ length: 4 }).map((_, i) => <HsSkeleton key={i} className="h-[118px] w-full" />)
          ) : (
            <>
              <MetricCard label="Total findings" value={String(overview.stats.totalFindings)} />
              <MetricCard label="Critical count" value={String(overview.stats.criticalCount)} />
              <MetricCard label="Sources scanned" value={String(overview.stats.sourcesScanned)} />
              <MetricCard label="False positives" value={String(overview.stats.falsePositives)} />
            </>
          )}
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <h2 className="text-hs-section font-semibold text-hs-text">Source connection</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <HsSelect
              label="Source type"
              value={sourceMode}
              onChange={(e) => setSourceMode(e.target.value as SourceMode)}
            >
              <option value="github">GitHub repository</option>
              <option value="upload">File upload</option>
            </HsSelect>
            {sourceMode === "github" ? (
              githubConnected === false ? (
                <div className="flex flex-col justify-end gap-2">
                  <p className="text-hs-secondary text-hs-muted">
                    Authorize GitHub first to select repositories.
                  </p>
                  <HsPrimaryButton type="button" onClick={handleConnectGitHub}>
                    Authorize GitHub
                  </HsPrimaryButton>
                </div>
              ) : (
                <HsSelect
                  label="Repository"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  helperText={repos.length ? `${repos.length} repos available` : "Loading repositories..."}
                >
                  {repos.length === 0 ? (
                    <option value="">No repositories found</option>
                  ) : (
                    repos.map((repo) => (
                      <option key={repo.id} value={repo.full_name}>
                        {repo.full_name}
                      </option>
                    ))
                  )}
                </HsSelect>
              )
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-hs-secondary font-medium text-[#374151]">Upload source file</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="h-10 w-full rounded-hs border border-hs-border bg-hs-card px-3 text-hs-secondary text-hs-text"
                />
              </div>
            )}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <HsPrimaryButton
              type="button"
              onClick={runScan}
              disabled={
                running ||
                (sourceMode === "github" && (!githubConnected || !selectedRepo))
              }
              loading={running}
            >
              Run Scan
            </HsPrimaryButton>
            {activeScan ? (
              <p className="text-hs-secondary text-hs-muted">
                {activeScan.source_name}: {activeScan.progress_percent}% - {activeScan.progress_message ?? "running"}
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <h2 className="text-hs-section font-semibold text-hs-text">Filters</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HsSelect label="Severity" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
              <option value="">All</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Informational">Informational</option>
            </HsSelect>
            <HsTextInput label="PHI type" value={filterType} onChange={(e) => setFilterType(e.target.value)} placeholder="SSN, DOB, Name..." />
            <HsSelect label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="false_positive">False positive</option>
              <option value="resolved">Resolved</option>
            </HsSelect>
            <HsTextInput label="Source" value={filterSource} onChange={(e) => setFilterSource(e.target.value)} placeholder="file path or repo" />
          </div>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-hs-section font-semibold text-hs-text">Scan results</h2>
            <HsSecondaryButton type="button" onClick={() => loadOverview()}>
              Refresh
            </HsSecondaryButton>
          </div>

          {loading ? (
            <div className="mt-5 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <HsSkeleton key={i} className="h-[52px] w-full" rounded="none" />
              ))}
            </div>
          ) : !overview || overview.findings.length === 0 ? (
            <div className="mt-5">
              <HsEmptyState
                title="No PHI scans yet"
                description="No PHI scans yet - connect a source and run the first scan."
              />
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse">
                <thead className="sticky top-0 bg-hs-page">
                  <tr className="h-12 border-b border-hs-fill bg-hs-page">
                    {["Source", "PHI Type", "Severity", "Line", "Evidence", "Owner", "Status", "Actions"].map(
                      (header) => (
                        <th
                          key={header}
                          className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {overview.findings.map((finding) => (
                    <tr key={finding.id} className="h-[52px] border-b border-hs-fill hover:bg-hs-fill-hover">
                      <td className="px-4 text-hs-secondary text-hs-text">{finding.source}</td>
                      <td className="px-4 text-hs-secondary text-hs-text">{finding.phi_type}</td>
                      <td className="px-4">
                        <span className={`inline-flex rounded-hs-pill border px-2 py-1 text-hs-caption font-medium ${severityStyle(finding.severity)}`}>
                          {finding.severity}
                        </span>
                      </td>
                      <td className="px-4 text-hs-secondary text-hs-text">{finding.line_number ?? "-"}</td>
                      <td className="max-w-[320px] truncate px-4 text-hs-secondary text-hs-text" title={finding.evidence}>
                        {finding.evidence}
                      </td>
                      <td className="px-4 text-hs-secondary text-hs-text">{finding.owner ?? "Unassigned"}</td>
                      <td className="px-4 text-hs-secondary text-hs-text">{finding.status}</td>
                      <td className="px-4">
                        <div className="flex flex-wrap gap-2">
                          <HsSecondaryButton
                            type="button"
                            className="h-8 px-3 text-hs-caption"
                            onClick={() => {
                              setFalsePositiveFinding(finding);
                              setFalsePositiveReason("");
                            }}
                          >
                            Mark false positive
                          </HsSecondaryButton>
                          <OwnerAssign finding={finding} onAssign={async (owner) => patchFinding(finding.id, { action: "assign_owner", owner })} />
                          <HsSecondaryButton
                            type="button"
                            className="h-8 px-3 text-hs-caption"
                            onClick={() => patchFinding(finding.id, { action: "resolve" }).catch((e) => setError(e.message))}
                          >
                            Resolve
                          </HsSecondaryButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <h2 className="text-hs-section font-semibold text-hs-text">Scan scheduling</h2>
          <p className="mt-1 text-hs-secondary text-hs-muted">Set recurring scans for tracked sources.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <HsTextInput
              label="Source"
              placeholder="org/repo or uploaded file path"
              value={scheduleSource}
              onChange={(e) => setScheduleSource(e.target.value)}
            />
            <HsSelect
              label="Frequency"
              value={scheduleFrequency}
              onChange={(e) =>
                setScheduleFrequency(e.target.value as "daily" | "weekly" | "monthly")
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </HsSelect>
          </div>
          <div className="mt-5">
            <HsPrimaryButton type="button" onClick={saveSchedule} loading={scheduleSaving} disabled={scheduleSaving}>
              Save Schedule
            </HsPrimaryButton>
          </div>
        </section>
      </div>

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
    <div className="flex items-center gap-2">
      <select
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        className="h-8 rounded-hs border border-hs-border bg-hs-card px-2 text-hs-caption text-hs-text"
      >
        {OWNER_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <HsSecondaryButton
        type="button"
        className="h-8 px-3 text-hs-caption"
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
