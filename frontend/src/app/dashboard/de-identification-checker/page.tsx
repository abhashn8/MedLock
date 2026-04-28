"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { DeidAssessment, DeidFinding, DeidJob, DeidStandard } from "@/lib/api/types";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsReadOnlyBanner } from "@/components/hipaa-shield/HsReadOnlyBanner";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { DataInputZone } from "@/components/deid/DataInputZone";
import { StandardSelector } from "@/components/deid/StandardSelector";
import { FindingCard } from "@/components/deid/FindingCard";
import { IdentifierChecklist } from "@/components/deid/IdentifierChecklist";
import { ExpertDeterminationPanel } from "@/components/deid/ExpertDeterminationPanel";
import { ColumnMappingTable, type MappingRow } from "@/components/deid/ColumnMappingTable";
import { RemediationChain } from "@/components/deid/RemediationChain";
import { useDashboardRbac } from "@/lib/rbac/context";

type Tab = "checker" | "deidentifier";

export default function DeIdentificationCheckerPage() {
  const rbac = useDashboardRbac();
  const canWrite = rbac.canWritePage("de_identification_checker");
  const [tab, setTab] = useState<Tab>("checker");
  const [standard, setStandard] = useState<DeidStandard>("safe_harbor");
  const [datasetLabel, setDatasetLabel] = useState("");
  const [rawText, setRawText] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [checkerLoading, setCheckerLoading] = useState(false);
  const [assessment, setAssessment] = useState<DeidAssessment | null>(null);
  const [history, setHistory] = useState<DeidAssessment[]>([]);
  const [deidStep, setDeidStep] = useState(1);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [runningJob, setRunningJob] = useState(false);
  const [job, setJob] = useState<DeidJob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const warningIdentifiers = useMemo(
    () =>
      (assessment?.findings ?? [])
        .filter((f) => f.severity === "warning")
        .map((f) => f.identifier_type),
    [assessment],
  );

  async function loadHistory() {
    const res = await apiFetch("/api/deid/history?tool=all&page=1&limit=30");
    const json = (await res.json()) as { assessments?: DeidAssessment[] };
    if (res.ok) setHistory(json.assessments ?? []);
  }

  async function runCheck() {
    if (!canWrite) return;
    setCheckerLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/deid/check", {
        method: "POST",
        body: JSON.stringify({ dataset_label: datasetLabel, standard, data: rawText }),
      });
      const json = (await res.json()) as { assessment_id?: string; message?: string };
      if (!res.ok || !json.assessment_id) throw new Error(json.message ?? "Check failed");
      const checkRes = await apiFetch(`/api/deid/check/${json.assessment_id}`);
      const checkJson = (await checkRes.json()) as DeidAssessment;
      if (!checkRes.ok) throw new Error("Failed to load assessment details");
      setAssessment(checkJson);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setCheckerLoading(false);
    }
  }

  async function runRecheck() {
    if (!assessment?.id || !canWrite) return;
    setCheckerLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/deid/check/${assessment.id}/recheck`, {
        method: "POST",
        body: JSON.stringify({ data: rawText, dataset_label: `${datasetLabel || assessment.dataset_label} (recheck)` }),
      });
      const json = (await res.json()) as { assessment_id?: string; message?: string };
      if (!res.ok || !json.assessment_id) throw new Error(json.message ?? "Re-check failed");
      const checkRes = await apiFetch(`/api/deid/check/${json.assessment_id}`);
      const checkJson = (await checkRes.json()) as DeidAssessment;
      if (!checkRes.ok) throw new Error("Failed to load re-check assessment");
      setAssessment(checkJson);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-check failed");
    } finally {
      setCheckerLoading(false);
    }
  }

  async function submitExpertReview(payload: {
    expert_reviewer_id: string;
    expert_credentials: string;
    expert_notes: string;
    approved: boolean;
  }) {
    if (!assessment?.id || !canWrite) return;
    const res = await apiFetch(`/api/deid/check/${assessment.id}/expert-review`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json?.message === "string" ? json.message : "Expert review failed");
      return;
    }
    const updated = (await res.json()) as DeidAssessment;
    setAssessment((prev) => (prev ? ({ ...prev, ...updated } as DeidAssessment) : prev));
    await loadHistory();
  }

  function prefillFromFindings(findings: DeidFinding[]) {
    const map = new Map<string, MappingRow>();
    for (const col of columns) map.set(col, { column_name: col, action: "keep" });
    for (const finding of findings) {
      const col = finding.column_name;
      const row = map.get(col) ?? { column_name: col, action: "keep" };
      const t = String(finding.identifier_type).toLowerCase();
      let action = row.action;
      if (t.includes("name") || t.includes("email") || t.includes("phone")) action = "remove";
      else if (t.includes("dob") || t.includes("date")) action = "truncate_year";
      else if (t.includes("zip")) action = "truncate_zip";
      else if (t.includes("ssn")) action = "mask";
      else if (t.includes("mrn")) action = "hash";
      map.set(col, { ...row, phi_type: finding.identifier_type, action });
    }
    setMappings(Array.from(map.values()));
  }

  async function runDeid() {
    if (!canWrite) return;
    setRunningJob(true);
    setError(null);
    try {
      const res = await apiFetch("/api/deid/run", {
        method: "POST",
        body: JSON.stringify({
          dataset_label: datasetLabel || "De-identified dataset",
          assessment_id: assessment?.id ?? null,
          data: rawText,
          column_mapping: mappings,
          strict_strip: true,
          ai_assist: true,
        }),
      });
      const json = (await res.json()) as { job_id?: string; download_url?: string | null; output_csv_base64?: string | null; message?: string };
      if (!res.ok || !json.job_id) throw new Error(json.message ?? "De-identification failed");
      const jobRes = await apiFetch(`/api/deid/run/${json.job_id}`);
      const jobJson = (await jobRes.json()) as DeidJob;
      if (!jobRes.ok) throw new Error("Failed to load job");
      setJob(jobJson);
      if (json.download_url) {
        setDownloadUrl(json.download_url);
      } else if (json.output_csv_base64) {
        const bytes = Uint8Array.from(atob(json.output_csv_base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        setDownloadUrl(objectUrl);
      } else {
        setDownloadUrl(null);
      }
      setDeidStep(4);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "De-identification failed");
    } finally {
      setRunningJob(false);
    }
  }

  async function runCheckerOnOutput() {
    if (!downloadUrl) return;
    const response = await fetch(downloadUrl);
    const text = await response.text();
    setTab("checker");
    setRawText(text);
    await runCheck();
  }

  async function downloadWithAuth(path: string, fallbackName: string) {
    try {
      const res = await apiFetch(path);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json?.message === "string" ? json.message : "Export failed");
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") ?? "";
      const matched = contentDisposition.match(/filename="([^"]+)"/i);
      const filename = matched?.[1] ?? fallbackName;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1240px] space-y-6">
        {rbac.permissionFor("de_identification_checker") === "read_only" ? <HsReadOnlyBanner /> : null}
        <section>
          <h1 className="text-hs-title font-semibold text-hs-text">De-identification Checker</h1>
          <p className="mt-2 text-hs-body text-hs-muted">
            Checker analyzes HIPAA de-identification readiness; De-identifier transforms raw data into a safely shareable output.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          <HsSecondaryButton type="button" className={tab === "checker" ? "bg-hs-fill" : ""} onClick={() => setTab("checker")}>
            Checker
          </HsSecondaryButton>
          <HsSecondaryButton type="button" className={tab === "deidentifier" ? "bg-hs-fill" : ""} onClick={() => setTab("deidentifier")}>
            De-identifier
          </HsSecondaryButton>
        </div>

        {error ? (
          <div className="rounded-hs border border-hs-danger-border bg-hs-danger-bg px-4 py-3 text-hs-body text-hs-danger">{error}</div>
        ) : null}
        <div className="rounded-hs border border-hs-border bg-hs-page/60 px-4 py-3 text-hs-caption text-hs-muted">
          De-identification run uses strict stripping by default (direct identifier patterns are redacted even if not explicitly mapped) and AI assistance for synthetic-safe replacements when needed.
        </div>

        {tab === "checker" ? (
          <>
            <StandardSelector value={standard} onChange={setStandard} />
            <DataInputZone
              datasetLabel={datasetLabel}
              onDatasetLabelChange={setDatasetLabel}
              onDataParsed={({ rawText: text, columns: cols }) => {
                setRawText(text);
                setColumns(cols);
                setMappings(cols.map((c) => ({ column_name: c, action: "keep" })));
              }}
            />
            {canWrite ? (
              <div className="flex gap-2">
                <HsPrimaryButton type="button" loading={checkerLoading} onClick={() => void runCheck()}>
                  Run check
                </HsPrimaryButton>
                {assessment ? (
                  <HsSecondaryButton type="button" loading={checkerLoading} onClick={() => void runRecheck()}>
                    Re-check after remediation
                  </HsSecondaryButton>
                ) : null}
              </div>
            ) : null}

            {assessment ? (
              <section className="space-y-4 rounded-hs-card border border-hs-border bg-hs-card p-5">
                <div className="flex flex-wrap items-center gap-2 text-hs-caption text-hs-secondary">
                  <span className="font-medium text-hs-text">{assessment.dataset_label}</span>
                  <span>·</span>
                  <span>{assessment.standard === "safe_harbor" ? "Safe Harbor" : "Expert Determination"}</span>
                  <span>·</span>
                  <span>Status: {assessment.status}</span>
                  <span>·</span>
                  <span>{assessment.identifier_count} identifiers found</span>
                  <span>·</span>
                  <span>{new Date(assessment.created_at).toLocaleString()}</span>
                </div>

                {assessment.findings.length > 0 ? (
                  <div className="space-y-3">
                    {assessment.findings.map((f, i) => (
                      <FindingCard
                        key={`${f.column_name}-${i}`}
                        finding={f as unknown as Record<string, unknown>}
                        onFix={
                          canWrite
                            ? (finding) => {
                                setTab("deidentifier");
                                prefillFromFindings([finding as unknown as DeidFinding]);
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <HsEmptyState title="No blocking identifiers found" description="This sample currently appears de-identified." />
                )}

                {assessment.standard === "safe_harbor" ? (
                  <IdentifierChecklist
                    passedIdentifiers={assessment.passed_identifiers ?? []}
                    failedIdentifiers={assessment.failed_identifiers ?? []}
                    warningIdentifiers={warningIdentifiers}
                  />
                ) : (
                  <ExpertDeterminationPanel
                    assessment={assessment as unknown as Record<string, unknown>}
                    onSubmitReview={canWrite ? submitExpertReview : undefined}
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <HsSecondaryButton
                    type="button"
                    onClick={() =>
                      void downloadWithAuth(
                        `/api/deid/check/${assessment.id}/report`,
                        `medlock-deid-assessment-${assessment.id.slice(0, 8)}.pdf`,
                      )
                    }
                  >
                    Export assessment report (PDF)
                  </HsSecondaryButton>
                  {canWrite ? (
                    <HsSecondaryButton
                      type="button"
                      onClick={() => {
                        setTab("deidentifier");
                        prefillFromFindings(assessment.findings);
                      }}
                    >
                      Fix with De-identifier
                    </HsSecondaryButton>
                  ) : null}
                </div>

                <RemediationChain
                  assessment={assessment as unknown as Record<string, unknown>}
                  chain={history.filter((h) => h.remediation_of === assessment.id || h.id === assessment.id) as unknown as Array<Record<string, unknown>>}
                />
              </section>
            ) : null}
          </>
        ) : (
          <>
            <DataInputZone
              datasetLabel={datasetLabel}
              onDatasetLabelChange={setDatasetLabel}
              onDataParsed={({ rawText: text, columns: cols }) => {
                setRawText(text);
                setColumns(cols);
                if (mappings.length === 0) setMappings(cols.map((c) => ({ column_name: c, action: "keep" })));
              }}
            />
            <section className="rounded-hs-card border border-hs-border bg-hs-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-hs-caption text-hs-muted">
                  Step {deidStep} of 4
                </p>
                {assessment ? (
                  <HsSecondaryButton
                    type="button"
                    className="h-8 px-2 text-hs-caption"
                    onClick={() => prefillFromFindings(assessment.findings)}
                  >
                    Import from checker
                  </HsSecondaryButton>
                ) : null}
              </div>

              {deidStep <= 2 ? (
                <ColumnMappingTable
                  columns={columns}
                  mappings={mappings}
                  onChange={setMappings}
                  onAutoMap={assessment ? () => prefillFromFindings(assessment.findings) : undefined}
                />
              ) : null}

              {deidStep === 3 ? (
                <div className="rounded-hs border border-hs-border bg-hs-page/60 px-4 py-3 text-hs-body text-hs-secondary">
                  Applying transformations... please wait.
                </div>
              ) : null}

              {deidStep === 4 ? (
                <div className="space-y-3 rounded-hs border border-hs-border bg-hs-page/60 p-4">
                  <h3 className="text-hs-section font-semibold text-hs-text">Results and download</h3>
                  <p className="text-hs-caption text-hs-secondary">
                    Rows in: {job?.row_count ?? "—"} · Rows out: {job?.output_row_count ?? "—"} · Rows suppressed: {job?.suppressed_rows ?? "—"}
                  </p>
                  <p className="text-hs-caption text-hs-secondary">
                    Columns in: {job?.column_count ?? "—"} · Columns out: {job?.output_column_count ?? "—"}
                  </p>
                  {downloadUrl ? (
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center rounded-hs border border-hs-primary px-4 text-hs-body font-medium text-hs-primary hover:bg-hs-info-bg"
                    >
                      Download de-identified file (CSV)
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <HsSecondaryButton type="button" onClick={() => void runCheckerOnOutput()}>
                      Run Checker on output
                    </HsSecondaryButton>
                    <HsSecondaryButton type="button" onClick={() => setDeidStep(2)}>
                      Edit mapping
                    </HsSecondaryButton>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {deidStep > 1 ? (
                  <HsSecondaryButton type="button" onClick={() => setDeidStep((s) => Math.max(1, s - 1))}>
                    Back
                  </HsSecondaryButton>
                ) : null}
                {canWrite && deidStep < 3 ? (
                  <HsPrimaryButton type="button" onClick={() => setDeidStep((s) => Math.min(3, s + 1))}>
                    Continue
                  </HsPrimaryButton>
                ) : null}
                {canWrite && deidStep === 3 ? (
                  <HsPrimaryButton type="button" loading={runningJob} onClick={() => void runDeid()}>
                    Run de-identification
                  </HsPrimaryButton>
                ) : null}
              </div>
            </section>
          </>
        )}

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-5">
          <h2 className="text-hs-section font-semibold text-hs-text">Check history</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-hs-caption text-hs-muted">No history yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-hs border border-hs-border">
              <table className="w-full min-w-[880px] border-collapse">
                <thead className="bg-hs-page">
                  <tr>
                    {["Dataset", "Standard", "Result", "Identifiers", "Tool", "Date", "Actions"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-t border-hs-fill">
                      <td className="px-3 py-2 text-hs-caption text-hs-text">{row.dataset_label}</td>
                      <td className="px-3 py-2 text-hs-caption text-hs-secondary">{row.standard}</td>
                      <td className="px-3 py-2 text-hs-caption text-hs-secondary">{row.status}</td>
                      <td className="px-3 py-2 text-hs-caption text-hs-secondary">{row.identifier_count}</td>
                      <td className="px-3 py-2 text-hs-caption text-hs-secondary">{row.tool}</td>
                      <td className="px-3 py-2 text-hs-caption text-hs-secondary">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <HsSecondaryButton
                            type="button"
                            className="h-8 px-2 text-hs-caption"
                            onClick={() => {
                              setAssessment(row);
                              setTab("checker");
                            }}
                          >
                            View
                          </HsSecondaryButton>
                          <HsSecondaryButton
                            type="button"
                            className="h-8 px-2 text-hs-caption"
                            onClick={() =>
                              void downloadWithAuth(
                                `/api/deid/check/${row.id}/export.csv`,
                                `medlock-deid-assessment-${row.id.slice(0, 8)}.csv`,
                              )
                            }
                          >
                            Export
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
      </div>
    </div>
  );
}
