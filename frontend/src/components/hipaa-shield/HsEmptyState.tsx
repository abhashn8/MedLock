import { cn } from "@/lib/utils"
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton"

export type HsEmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

/**
 * Use when a module has no data yet or a feature is not configured.
 */
export function HsEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: HsEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <div
        className="mb-6 flex size-24 items-center justify-center rounded-hs-card border border-hs-border bg-hs-fill"
        aria-hidden
      >
        <svg viewBox="0 0 64 64" className="size-14 text-hs-placeholder" fill="none">
          <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M20 28h24M20 36h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-hs-section font-medium text-hs-text">{title}</h3>
      <p className="mt-2 max-w-[320px] text-hs-body font-normal text-hs-muted">
        {description}
      </p>
      {actionLabel && onAction ? (
        <div className="mt-4">
          <HsPrimaryButton type="button" onClick={onAction}>
            {actionLabel}
          </HsPrimaryButton>
        </div>
      ) : null}
    </div>
  )
}
