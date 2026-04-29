"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getVendorRiskPortfolio,
  postVendorRiskRecalculate,
  type VendorPortfolioRow,
  type VendorRiskBaaStatus,
  type VendorRiskPortfolioResponse,
} from "@/lib/api/vendor-risk-scores";
import { useDashboardRbac } from "@/lib/rbac/context";
import { HsAlertBanner } from "@/components/hipaa-shield/HsAlertBanner";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsReadOnlyBanner } from "@/components/hipaa-shield/HsReadOnlyBanner";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { cn } from "@/lib/utils";

function friendlyError(message: string) {
  if (message === "Failed to fetch" || message.toLowerCase().includes("fetch")) {
    return "Data unavailable: start the backend API on port 4000 and refresh.";
  }
  return message;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

const statusStyles: Record<VendorRiskBaaStatus, string> = {
  PASS: "border-hs-success-border bg-hs-success-bg text-hs-success",
  WARNING: "border-[#FDE68A] bg-hs-warning-bg text-hs-warning",
  FAIL: "border-hs-danger-border bg-hs-danger-bg text-hs-danger",
  PENDING: "border-hs-border bg-hs-fill text-hs-muted",
};

function scoreBucketIndex(score: number | null): number | null {
  if (score == null) return null;
  return Math.min(9, Math.floor(score / 10));
}

export default function VendorRiskScoresPage() {
  const router = useRouter();
  const rbac = useDashboardRbac();
  const canWrite = rbac.canWritePage("vendor_risk_scores");
  const readOnly = rbac.permissionFor("vendor_risk_scores") === "read_only";

  const [data, setData] = useState<VendorRiskPortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getVendorRiskPortfolio());
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Failed to load portfolio."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const histogram = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      label: `${i * 10}–${i * 10 + 9}`,
      count: 0,
    }));
    if (!data?.vendors.length) {
      return buckets.map((b) => ({ ...b, pct: 0 }));
    }
    for (const v of data.vendors) {
      const idx = scoreBucketIndex(v.risk_score);
      if (idx != null) buckets[idx].count += 1;
    }
    const max = Math.max(1, ...buckets.map((b) => b.count));
    return buckets.map((b) => ({ ...b, pct: (b.count / max) * 100 }));
  }, [data]);

  const statusBars = useMemo(() => {
    const order: VendorRiskBaaStatus[] = ["FAIL", "WARNING", "PENDING", "PASS"];
    const s = data?.summary.byStatus;
    if (!s) return order.map((key) => ({ key, count: 0, pct: 0 }));
    const max = Math.max(1, ...order.map((k) => s[k]));
    return order.map((key) => ({ key, count: s[key], pct: (s[key] / max) * 100 }));
  }, [data]);

  const sortedVendors = useMemo(() => {
    if (!data?.vendors.length) return [];
    return [...data.vendors].sort((a, b) => (b.risk_score ?? -1) - (a.risk_score ?? -1));
  }, [data]);

  async function onRecalculate() {
    setError(null);
    setSuccess(null);
    try {
      setRecalcLoading(true);
      const res = await postVendorRiskRecalculate();
      setSuccess(
        `Recalculated ${res.updated} vendor(s) (model ${res.modelVersion}). Risk scores and BAA status are saved on each vendor row—open BAA Tracker and refresh to see the same values.`,
      );
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Recalculate failed."));
    } finally {
      setRecalcLoading(false);
    }
  }

  function toggleExpand(row: VendorPortfolioRow) {
    setExpandedId((prev) => (prev === row.id ? null : row.id));
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1280px] space-y-6">
        {readOnly ? <HsReadOnlyBanner /> : null}
        {error ? (
          <HsAlertBanner variant="WARNING" onDismiss={() => setError(null)}>
            <span className="font-medium">Vendor risk:</span> {error}
          </HsAlertBanner>
        ) : null}
        {success ? (
          <HsAlertBanner variant="INFO" onDismiss={() => setSuccess(null)}>
            {success}{" "}
            <Link href="/dashboard/baa-tracker" className="font-medium text-hs-primary underline">
              Open BAA Tracker
            </Link>
          </HsAlertBanner>
        ) : null}

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-hs-caption font-semibold uppercase tracking-[0.1em] text-hs-primary">
                Vendors & Partners
              </p>
              <h1 className="mt-2 text-hs-title font-semibold text-hs-text">Vendor risk scores</h1>
              <p className="mt-2 max-w-2xl text-hs-body text-hs-muted">
                Portfolio view of vendors from{" "}
                <Link href="/dashboard/baa-tracker" className="font-medium text-hs-primary underline">
                  BAA Tracker
                </Link>
                . Scores combine BAA dates, MOU on file, subcontractor posture, and certifications. Recalculate persists
                <span className="font-medium text-hs-text"> risk_score</span> and{" "}
                <span className="font-medium text-hs-text">baa_status</span> to{" "}
                <code className="rounded bg-hs-fill px-1 py-0.5 text-sm">public.vendors</code>.
              </p>
              {data ? (
                <p className="mt-2 text-hs-caption text-hs-muted">Model version: {data.modelVersion}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <HsSecondaryButton type="button" onClick={() => void load()} disabled={loading}>
                Refresh
              </HsSecondaryButton>
              {canWrite ? (
                <HsPrimaryButton type="button" onClick={() => void onRecalculate()} loading={recalcLoading} disabled={loading}>
                  Recalculate all
                </HsPrimaryButton>
              ) : null}
            </div>
          </div>
        </section>

        {loading ? (
          <section className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <HsSkeleton key={i} className="h-24 rounded-hs-card" />
            ))}
          </section>
        ) : !data || data.vendors.length === 0 ? (
          <HsEmptyState
            title="No vendors to score"
            description="Add vendors in BAA Tracker, then return here to analyze the portfolio."
            actionLabel="Go to BAA Tracker"
            onAction={() => router.push("/dashboard/baa-tracker")}
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <article className="rounded-hs-card border border-hs-border bg-hs-card p-5">
                <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Vendors</p>
                <p className="mt-2 text-3xl font-semibold text-hs-text">{data.summary.count}</p>
              </article>
              <article className="rounded-hs-card border border-hs-border bg-hs-card p-5">
                <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Avg risk score</p>
                <p className="mt-2 text-3xl font-semibold text-hs-text">
                  {data.summary.avgRiskScore ?? "—"}
                </p>
              </article>
              <article className="rounded-hs-card border border-hs-border bg-hs-card p-5">
                <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">BAA expiring (60d)</p>
                <p className="mt-2 text-3xl font-semibold text-hs-text">{data.summary.expiringBaaWithin60Days}</p>
              </article>
              <article className="rounded-hs-card border border-hs-border bg-hs-card p-5">
                <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">In FAIL status</p>
                <p className="mt-2 text-3xl font-semibold text-hs-text">{data.summary.byStatus.FAIL}</p>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
                <h2 className="text-hs-section font-semibold text-hs-text">Risk score distribution</h2>
                <p className="mt-1 text-sm text-hs-muted">Count of vendors per ten-point band (higher = riskier).</p>
                <div className="mt-6 flex h-48 items-end justify-between gap-1">
                  {histogram.map((b) => (
                    <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex w-full flex-1 items-end justify-center">
                        <div
                          className="w-full max-w-[28px] rounded-t bg-hs-primary/80"
                          style={{ height: `${Math.max(4, b.pct)}%` }}
                          title={`${b.label}: ${b.count}`}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-hs-muted">{b.label.replace("–", "-")}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
                <h2 className="text-hs-section font-semibold text-hs-text">Derived BAA status mix</h2>
                <p className="mt-1 text-sm text-hs-muted">After recalculation, statuses reflect portfolio health rules.</p>
                <ul className="mt-6 space-y-3">
                  {statusBars.map((row) => (
                    <li key={row.key} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "w-20 shrink-0 rounded-hs-pill border px-2 py-0.5 text-center text-hs-caption font-medium",
                          statusStyles[row.key],
                        )}
                      >
                        {row.key}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-hs-fill">
                        <div className="h-full rounded-full bg-hs-primary" style={{ width: `${row.pct}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm text-hs-text">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-hs-section font-semibold text-hs-text">Vendor detail</h2>
                  <p className="text-sm text-hs-muted">Highest risk first. Expand for scoring drivers.</p>
                </div>
              </div>
              <div className="max-h-[480px] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[960px] border-collapse">
                  <thead>
                    <tr className="h-12 border-b border-hs-fill bg-hs-page">
                      <th className="px-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                        Vendor
                      </th>
                      <th className="px-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                        Risk
                      </th>
                      <th className="px-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                        Status
                      </th>
                      <th className="px-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                        BAA expires
                      </th>
                      <th className="px-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                        MOU
                      </th>
                      <th className="px-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                        Subs
                      </th>
                      <th className="px-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                        Certs
                      </th>
                      <th className="px-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                        Last run
                      </th>
                      <th className="px-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVendors.map((row) => (
                      <Fragment key={row.id}>
                        <tr className="h-14 border-b border-hs-fill">
                          <td className="px-3 text-sm font-medium text-hs-text">{row.name}</td>
                          <td className="px-3 text-sm text-hs-text">{row.risk_score ?? "—"}</td>
                          <td className="px-3">
                            <span
                              className={cn(
                                "inline-flex rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium",
                                statusStyles[row.baa_status],
                              )}
                            >
                              {row.baa_status}
                            </span>
                          </td>
                          <td className="px-3 text-sm text-hs-text">{formatDate(row.baa_expires_at)}</td>
                          <td className="px-3 text-sm text-hs-text">{row.mou_document_path ? "Yes" : "No"}</td>
                          <td className="px-3 text-sm text-hs-text">
                            {row.subcontractor_count}
                            {row.subcontractor_worst ? (
                              <span className="text-hs-muted"> · {row.subcontractor_worst}</span>
                            ) : null}
                          </td>
                          <td className="px-3 text-sm text-hs-text">
                            {row.certification_count}
                            {row.nearest_cert_expiry ? (
                              <span className="text-hs-muted"> · {formatDate(row.nearest_cert_expiry)}</span>
                            ) : null}
                          </td>
                          <td className="px-3 text-sm text-hs-muted">{formatDate(row.risk_computed_at)}</td>
                          <td className="px-3">
                            <HsSecondaryButton type="button" onClick={() => toggleExpand(row)}>
                              {expandedId === row.id ? "Hide" : "Drivers"}
                            </HsSecondaryButton>
                          </td>
                        </tr>
                        {expandedId === row.id ? (
                          <tr className="border-b border-hs-fill bg-hs-page">
                            <td colSpan={9} className="px-3 py-4">
                              {row.risk_breakdown?.factors?.length ? (
                                <ul className="space-y-2 text-sm text-hs-text">
                                  {row.risk_breakdown.factors.map((f) => (
                                    <li key={f.id} className="flex justify-between gap-4 border-b border-hs-fill/80 py-1 last:border-0">
                                      <span>{f.label}</span>
                                      <span className="font-mono text-hs-muted">+{f.points}</span>
                                    </li>
                                  ))}
                                  <li className="flex justify-between pt-2 font-medium">
                                    <span>Total (capped)</span>
                                    <span>
                                      {row.risk_breakdown.rawTotal} → {row.risk_breakdown.score}
                                    </span>
                                  </li>
                                </ul>
                              ) : (
                                <p className="text-sm text-hs-muted">No breakdown stored yet. Run recalculate.</p>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
