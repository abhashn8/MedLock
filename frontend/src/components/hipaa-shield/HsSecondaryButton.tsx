import { cn } from "@/lib/utils"

export type HsSecondaryButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean
  }

/**
 * Secondary actions: cancel adjacent to primary, low-emphasis CTAs.
 */
export function HsSecondaryButton({
  className,
  children,
  disabled,
  loading,
  type = "button",
  ...props
}: HsSecondaryButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        "inline-flex h-10 min-w-[40px] items-center justify-center rounded-hs border border-hs-border bg-hs-card px-4 text-hs-body font-medium text-[#374151]",
        "hs-transition-button-bg hover:bg-hs-fill-hover",
        "focus-visible:outline-none focus-visible:shadow-hs-focus",
        "disabled:cursor-not-allowed disabled:bg-hs-fill disabled:text-hs-placeholder",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-hs-border border-t-hs-muted"
          aria-hidden
        />
      ) : (
        children
      )}
    </button>
  )
}
