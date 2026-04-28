"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { HsSeverityBadge, type HsSeverity } from "@/components/hipaa-shield/HsSeverityBadge"
import { HsStatusPill } from "@/components/hipaa-shield/HsStatusPill"
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton"
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton"
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState"
import { ChevronDown, ChevronUp } from "lucide-react"
import { HsIcon } from "@/components/hipaa-shield/HsIcon"

export type HsFindingRow = {
  id: string
  title: string
  description: string
  severity: HsSeverity
  module: string
  ownerName: string
  ownerInitials: string
  dueDate: string
  overdue?: boolean
  status: "PASS" | "FAIL" | "WARNING" | "PENDING"
  statusLabel: string
}

export type HsFindingsTableProps = {
  rows: HsFindingRow[]
  loading?: boolean
  error?: string | null
  emptyTitle?: string
  emptyDescription?: string
  className?: string
}

type SortKey = "title" | "dueDate" | "severity"

/**
 * Primary findings register for remediation tracking.
 */
export function HsFindingsTable({
  rows,
  loading,
  error,
  emptyTitle = "No findings",
  emptyDescription = "There are no open findings for this scope.",
  className,
}: HsFindingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("dueDate")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === "title") cmp = a.title.localeCompare(b.title)
      else if (sortKey === "severity") {
        const order: HsSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
        cmp = order.indexOf(a.severity) - order.indexOf(b.severity)
      } else {
        cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "title" ? "asc" : "desc")
    }
  }

  if (loading) {
    return (
      <div className={cn("w-full space-y-2", className)} aria-busy>
        {Array.from({ length: 6 }).map((_, i) => (
          <HsSkeleton key={i} className="h-[52px] w-full" rounded="none" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-hs-card border border-hs-danger-border bg-hs-danger-bg px-6 py-4 text-hs-body text-hs-danger",
          className,
        )}
        role="alert"
      >
        {error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={cn("rounded-hs-card border border-hs-border bg-hs-card", className)}>
        <HsEmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full min-w-[880px] border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-hs-page">
          <tr className="h-12 border-b border-hs-border bg-hs-page">
            <th className="w-28 px-4 text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
              Severity
            </th>
            <th className="min-w-[240px] px-4">
              <button
                type="button"
                onClick={() => toggleSort("title")}
                className="inline-flex items-center gap-1 text-hs-caption font-medium uppercase tracking-wide text-hs-muted hover:text-hs-text focus-visible:outline-none focus-visible:shadow-hs-focus"
              >
                Finding
                {sortKey === "title" ? (
                  <HsIcon
                    icon={sortDir === "asc" ? ChevronUp : ChevronDown}
                    className="text-hs-primary"
                  />
                ) : null}
              </button>
            </th>
            <th className="w-36 px-4 text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
              Module
            </th>
            <th className="min-w-[160px] px-4 text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
              Owner
            </th>
            <th className="w-36 px-4">
              <button
                type="button"
                onClick={() => toggleSort("dueDate")}
                className="inline-flex items-center gap-1 text-hs-caption font-medium uppercase tracking-wide text-hs-muted hover:text-hs-text focus-visible:outline-none focus-visible:shadow-hs-focus"
              >
                Due
                {sortKey === "dueDate" ? (
                  <HsIcon
                    icon={sortDir === "asc" ? ChevronUp : ChevronDown}
                    className="text-hs-primary"
                  />
                ) : null}
              </button>
            </th>
            <th className="w-36 px-4 text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
              Status
            </th>
            <th className="w-28 px-4 text-right text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              className="h-[52px] border-b border-hs-fill bg-hs-card hover:bg-hs-fill-hover"
            >
              <td className="px-4 align-middle">
                <HsSeverityBadge severity={row.severity} />
              </td>
              <td className="px-4 align-middle">
                <p className="text-hs-secondary font-normal text-hs-text">{row.title}</p>
                <p className="text-hs-caption font-normal text-hs-muted">{row.description}</p>
              </td>
              <td className="px-4 align-middle">
                <span className="inline-flex rounded-hs-pill border border-hs-border bg-hs-fill px-2 py-1 text-hs-caption font-medium text-hs-muted">
                  {row.module}
                </span>
              </td>
              <td className="px-4 align-middle">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-hs-fill text-hs-caption font-medium text-hs-muted">
                    {row.ownerInitials}
                  </span>
                  <span className="text-hs-secondary font-normal text-hs-text">
                    {row.ownerName}
                  </span>
                </div>
              </td>
              <td
                className={cn(
                  "px-4 align-middle text-hs-secondary font-normal",
                  row.overdue ? "text-hs-danger" : "text-hs-text",
                )}
              >
                {row.dueDate}
              </td>
              <td className="px-4 align-middle">
                <HsStatusPill variant={row.status}>{row.statusLabel}</HsStatusPill>
              </td>
              <td className="px-4 text-right align-middle">
                <HsSecondaryButton type="button" className="h-8 px-3 text-hs-caption">
                  Open
                </HsSecondaryButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
