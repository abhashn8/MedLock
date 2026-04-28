import { cn } from "@/lib/utils"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { HsIcon } from "@/components/hipaa-shield/HsIcon"

export type HsMetricCardProps = {
  label: string
  value: string
  context: string
  trendPercent: number
  trendPositive?: boolean
  className?: string
}

/**
 * KPI tiles on the executive overview and module dashboards.
 */
export function HsMetricCard({
  label,
  value,
  context,
  trendPercent,
  trendPositive = true,
  className,
}: HsMetricCardProps) {
  const up = trendPositive
  return (
    <div
      className={cn(
        "rounded-hs-card border border-hs-border bg-hs-card p-6 hs-transition-border hover:border-hs-border-strong",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-hs-secondary font-normal text-hs-muted">{label}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-hs-caption font-medium",
            up ? "text-hs-success" : "text-hs-danger",
          )}
        >
          {up ? <HsIcon icon={ArrowUpRight} /> : <HsIcon icon={ArrowDownRight} />}
          {Math.abs(trendPercent)}%
        </span>
      </div>
      <p className="mt-2 text-hs-metric font-semibold text-hs-text">{value}</p>
      <p className="mt-2 text-hs-caption font-normal text-hs-placeholder">{context}</p>
    </div>
  )
}
