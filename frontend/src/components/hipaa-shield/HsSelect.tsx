import { cn } from "@/lib/utils"

export type HsSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  helperText?: string
  errorText?: string
}

/**
 * Native select styled to match text inputs.
 */
export function HsSelect({
  id,
  label,
  helperText,
  errorText,
  className,
  disabled,
  children,
  ...props
}: HsSelectProps) {
  const selectId = id ?? props.name
  const hasError = Boolean(errorText)

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={selectId}
          className="text-hs-secondary font-medium text-[#374151]"
        >
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        disabled={disabled}
        className={cn(
          "h-10 w-full appearance-none rounded-hs border bg-hs-card px-3 text-hs-body font-normal text-hs-text",
          "hs-transition-border focus:outline-none focus:shadow-hs-focus focus:ring-0",
          hasError
            ? "border-hs-danger shadow-hs-focus-error focus:border-hs-danger"
            : "border-hs-border focus:border-hs-primary",
          disabled && "cursor-not-allowed bg-hs-fill text-hs-placeholder",
          className,
        )}
        aria-invalid={hasError || undefined}
        {...props}
      >
        {children}
      </select>
      {helperText && !errorText ? (
        <p className="text-hs-caption text-hs-muted">{helperText}</p>
      ) : null}
      {errorText ? (
        <p className="text-hs-caption text-hs-danger" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  )
}
