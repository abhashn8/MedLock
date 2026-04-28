import { cn } from "@/lib/utils"

export type HsStatusVariant = "PASS" | "FAIL" | "WARNING" | "PENDING"

export type HsStatusPillProps = {
  variant: HsStatusVariant
  children: React.ReactNode
  className?: string
}

const styles: Record<
  HsStatusVariant,
  { bg: string; text: string; label: string }
> = {
  PASS: {
    bg: "bg-hs-success-bg",
    text: "text-hs-success",
    label: "Pass",
  },
  FAIL: {
    bg: "bg-hs-danger-bg",
    text: "text-hs-danger",
    label: "Fail",
  },
  WARNING: {
    bg: "bg-hs-warning-bg",
    text: "text-hs-warning",
    label: "Warning",
  },
  PENDING: {
    bg: "bg-hs-fill",
    text: "text-hs-muted",
    label: "Pending",
  },
}

/**
 * Pass/fail/warning/pending labels for controls, audits, and table rows.
 * Always shows visible text; color is not the only cue (variant maps to label prefix in copy).
 */
export function HsStatusPill({ variant, children, className }: HsStatusPillProps) {
  const s = styles[variant]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-hs-pill px-3 py-1.5 text-hs-caption font-medium",
        s.bg,
        s.text,
        className,
      )}
      title={s.label}
    >
      {children}
    </span>
  )
}
