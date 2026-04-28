import { cn } from "@/lib/utils"

export type HsSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

export type HsSeverityBadgeProps = {
  severity: HsSeverity
  className?: string
}

const map: Record<
  HsSeverity,
  { className: string; label: string }
> = {
  CRITICAL: {
    className:
      "border border-hs-danger-border bg-hs-danger-bg text-hs-danger",
    label: "Critical",
  },
  HIGH: {
    className:
      "border border-hs-warning-border bg-hs-warning-bg text-hs-warning",
    label: "High",
  },
  MEDIUM: {
    className: "border border-hs-info-border bg-hs-info-bg text-hs-info",
    label: "Medium",
  },
  LOW: {
    className: "border border-hs-success-border bg-hs-low-bg text-hs-low-text",
    label: "Low",
  },
}

/**
 * Severity chips for findings and risk registers.
 */
export function HsSeverityBadge({ severity, className }: HsSeverityBadgeProps) {
  const m = map[severity]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-hs-pill px-2 py-1 text-[11px] font-medium leading-none",
        m.className,
        className,
      )}
    >
      {m.label}
    </span>
  )
}
