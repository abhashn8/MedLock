import { cn } from "@/lib/utils"

export type HsDangerButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
}

/**
 * Destructive confirmations: delete, revoke access.
 */
export function HsDangerButton({
  className,
  children,
  disabled,
  loading,
  type = "button",
  ...props
}: HsDangerButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        "inline-flex h-10 min-w-[40px] items-center justify-center rounded-hs px-4 text-hs-body font-medium text-white",
        "bg-hs-danger hs-transition-button-bg hover:bg-red-300",
        "active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-hs-focus-error",
        "disabled:cursor-not-allowed disabled:bg-hs-border disabled:text-hs-placeholder",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden
        />
      ) : (
        children
      )}
    </button>
  )
}
