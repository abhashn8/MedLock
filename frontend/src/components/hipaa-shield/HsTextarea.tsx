import { cn } from "@/lib/utils"

export type HsTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  helperText?: string
  errorText?: string
}

/**
 * Multi-line notes: incident descriptions, policy text.
 */
export function HsTextarea({
  id,
  label,
  helperText,
  errorText,
  className,
  disabled,
  ...props
}: HsTextareaProps) {
  const tid = id ?? props.name
  const hasError = Boolean(errorText)

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label ? (
        <label htmlFor={tid} className="text-hs-secondary font-medium text-[#374151]">
          {label}
        </label>
      ) : null}
      <textarea
        id={tid}
        disabled={disabled}
        className={cn(
          "min-h-[96px] w-full rounded-hs border bg-hs-card px-3 py-2 text-hs-body font-normal text-hs-text placeholder:text-hs-placeholder",
          "hs-transition-border focus:outline-none focus:shadow-hs-focus focus:ring-0",
          hasError
            ? "border-hs-danger shadow-hs-focus-error focus:border-hs-danger"
            : "border-hs-border focus:border-hs-primary",
          disabled && "cursor-not-allowed bg-hs-fill text-hs-placeholder",
          className,
        )}
        aria-invalid={hasError || undefined}
        {...props}
      />
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
