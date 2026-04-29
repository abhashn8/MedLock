import { cn } from "@/lib/utils"
import { HsIcon } from "@/components/hipaa-shield/HsIcon"
import { AlertTriangle, Info, X } from "lucide-react"

export type HsAlertBannerVariant = "CRITICAL" | "WARNING" | "INFO"

export type HsAlertBannerProps = {
  variant: HsAlertBannerVariant
  children: React.ReactNode
  onDismiss?: () => void
  className?: string
}

const variantStyles: Record<
  HsAlertBannerVariant,
  { wrap: string; border: string; icon: typeof AlertTriangle }
> = {
  CRITICAL: {
    wrap: "bg-hs-danger-bg text-hs-text",
    border: "border-l-hs-danger",
    icon: AlertTriangle,
  },
  WARNING: {
    wrap: "bg-hs-warning-bg text-hs-text",
    border: "border-l-hs-warning",
    icon: AlertTriangle,
  },
  INFO: {
    wrap: "bg-hs-info-bg text-hs-text",
    border: "border-l-hs-info",
    icon: Info,
  },
}

/**
 * Full-width compliance alerts below the top bar. No border radius per spec.
 */
export function HsAlertBanner({
  variant,
  children,
  onDismiss,
  className,
}: HsAlertBannerProps) {
  const v = variantStyles[variant] ?? variantStyles.INFO
  return (
    <div
      role="alert"
      className={cn(
        "flex w-full items-start gap-3 border-l-4 py-4 pl-6 pr-6 text-hs-body font-normal",
        v.border,
        v.wrap,
        className,
      )}
    >
      <HsIcon icon={v.icon} className={cn(variant === "INFO" ? "text-hs-info" : variant === "WARNING" ? "text-hs-warning" : "text-hs-danger")} />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-hs p-1 text-hs-muted hs-transition-border hover:bg-black/5 focus-visible:outline-none focus-visible:shadow-hs-focus"
          aria-label="Dismiss"
        >
          <HsIcon icon={X} className="text-hs-muted" />
        </button>
      ) : null}
    </div>
  )
}
