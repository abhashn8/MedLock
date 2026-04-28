import { cn } from "@/lib/utils"

export type HsTextInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  label?: string
  helperText?: string
  errorText?: string
}

/**
 * Single-line text fields in forms and the global search bar.
 * Supports default, focus, disabled, error; empty is N/A for input value (use placeholder + label).
 */
export function HsTextInput({
  id,
  label,
  helperText,
  errorText,
  className,
  disabled,
  ...props
}: HsTextInputProps) {
  const inputId = id ?? props.name
  const hasError = Boolean(errorText)

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-hs-secondary font-medium text-hs-text"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        disabled={disabled}
        className={cn(
          "h-10 w-full rounded-hs border bg-hs-card px-3 text-hs-body font-normal text-hs-text placeholder:text-hs-placeholder",
          "hs-transition-border focus:outline-none focus:shadow-hs-focus focus:ring-0",
          hasError
            ? "border-hs-danger shadow-hs-focus-error focus:border-hs-danger"
            : "border-hs-border focus:border-hs-primary",
          disabled && "cursor-not-allowed bg-hs-fill text-hs-placeholder",
          className,
        )}
        aria-invalid={hasError || undefined}
        aria-describedby={
          [helperText && `${inputId}-help`, errorText && `${inputId}-err`]
            .filter(Boolean)
            .join(" ") || undefined
        }
        {...props}
      />
      {helperText && !errorText ? (
        <p id={`${inputId}-help`} className="text-hs-caption text-hs-muted">
          {helperText}
        </p>
      ) : null}
      {errorText ? (
        <p id={`${inputId}-err`} className="text-hs-caption text-hs-danger" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  )
}
