import { cn } from "@/lib/utils"

export type HsPrimaryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
}

/**
 * Primary actions: submit, confirm, Run Scan. Uses brand blue only on controls.
 * Loading: N/A for empty; disabled/loading states supported.
 */
export function HsPrimaryButton({
  className,
  children,
  disabled,
  loading,
  type = "button",
  ...props
}: HsPrimaryButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        "inline-flex h-10 min-w-[40px] items-center justify-center rounded-hs px-4 text-hs-body font-medium text-white",
        "bg-hs-primary hs-transition-button-bg",
        "hover:bg-hs-primary-hover active:scale-[0.98] active:bg-hs-primary-active",
        "focus-visible:outline-none focus-visible:shadow-hs-focus",
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
