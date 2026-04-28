"use client"

import { useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { CheckCircle2, Circle, FileText, ShieldCheck } from "lucide-react"
import { getFeatureSpecByHref } from "@/app/dashboard/feature-content"
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState"
import { HsIcon } from "@/components/hipaa-shield/HsIcon"
import { HsMetricCard } from "@/components/hipaa-shield/HsMetricCard"
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton"
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton"
import { HsStatusPill } from "@/components/hipaa-shield/HsStatusPill"

/**
 * Feature route for every dashboard module.
 */
export default function DashboardFeaturePage() {
  const params = useParams<{ slug: string[] }>()
  const router = useRouter()

  const href = useMemo(() => {
    const parts = params.slug ?? []
    return `/dashboard/${parts.join("/")}`
  }, [params.slug])

  const feature = getFeatureSpecByHref(href)

  if (!feature) {
    return (
      <div className="p-8">
        <HsEmptyState
          title="Feature not found"
          description="This dashboard route does not map to a MedLock module."
          actionLabel="Back to Dashboard"
          onAction={() => router.push("/dashboard")}
        />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1200px] space-y-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-hs-caption font-medium uppercase tracking-[0.08em] text-hs-placeholder">
                {feature.section}
              </span>
              <HsStatusPill variant={feature.status}>{feature.statusLabel}</HsStatusPill>
            </div>
            <div className="space-y-2">
              <h1 className="text-hs-title font-semibold text-hs-text">
                {feature.title}
              </h1>
              <p className="text-hs-body font-normal text-hs-muted">
                {feature.purpose}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {feature.roles.map((role) => (
                <span
                  key={role}
                  className="rounded-hs-pill border border-hs-border bg-hs-card px-3 py-1.5 text-hs-caption font-medium text-hs-muted"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <HsSecondaryButton type="button" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </HsSecondaryButton>
            <HsPrimaryButton type="button">{feature.primaryAction}</HsPrimaryButton>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {feature.metrics.map((metric) => (
            <HsMetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              context={metric.context}
              trendPercent={metric.trendPercent}
              trendPositive={metric.trendPositive}
            />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
            <div className="flex items-center gap-2">
              <HsIcon icon={ShieldCheck} className="text-hs-primary" />
              <h2 className="text-hs-section font-semibold text-hs-text">
                Operational workflow
              </h2>
            </div>
            <ol className="mt-5 space-y-4">
              {feature.workflow.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-hs-info-bg text-hs-caption font-medium text-hs-primary">
                    {index + 1}
                  </span>
                  <p className="pt-0.5 text-hs-body font-normal text-hs-text">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-6 border-t border-hs-border pt-5">
              <HsSecondaryButton type="button">{feature.secondaryAction}</HsSecondaryButton>
            </div>
          </div>

          <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
            <div className="flex items-center gap-2">
              <HsIcon icon={FileText} className="text-hs-primary" />
              <h2 className="text-hs-section font-semibold text-hs-text">
                Module controls
              </h2>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="h-12 border-b border-hs-fill bg-hs-page">
                    {feature.table.headers.map((header) => (
                      <th
                        key={header}
                        className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {feature.table.rows.map((row, rowIndex) => (
                    <tr
                      key={`${feature.href}-${rowIndex}`}
                      className="h-[52px] border-b border-hs-fill hover:bg-hs-fill-hover"
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${cell}-${cellIndex}`}
                          className="px-4 text-hs-secondary font-normal text-hs-text"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
            <div className="flex items-center gap-2">
              <HsIcon icon={CheckCircle2} className="text-hs-success" />
              <h2 className="text-hs-section font-semibold text-hs-text">
                States covered
              </h2>
            </div>
            <ul className="mt-5 space-y-3 text-hs-body font-normal text-hs-muted">
              <li>Loading: page-level skeletons before data arrives.</li>
              <li>Error: retryable alert with operational guidance.</li>
              <li>Empty: {feature.emptyState.title.toLowerCase()}.</li>
            </ul>
          </div>

          <div className="rounded-hs-card border border-hs-border bg-hs-card p-6 lg:col-span-2">
            <div className="flex items-center gap-2">
              <HsIcon icon={Circle} className="text-hs-primary" />
              <h2 className="text-hs-section font-semibold text-hs-text">
                Empty state
              </h2>
            </div>
            <div className="mt-5 rounded-hs border border-dashed border-hs-border bg-hs-page px-4 py-5">
              <p className="text-hs-body font-medium text-hs-text">
                {feature.emptyState.title}
              </p>
              <p className="mt-1 text-hs-secondary font-normal text-hs-muted">
                {feature.emptyState.description}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
