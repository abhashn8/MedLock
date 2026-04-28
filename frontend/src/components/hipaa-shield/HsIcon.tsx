import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type HsIconProps = {
  /** Lucide icon at fixed 16px per design system */
  icon: LucideIcon
  className?: string
  "aria-hidden"?: boolean
}

/**
 * Wraps Lucide icons at 16×16 for nav, buttons, and dense UI.
 * Use for every MedLock surface icon.
 */
export function HsIcon({
  icon: Icon,
  className,
  "aria-hidden": ariaHidden = true,
}: HsIconProps) {
  return (
    <Icon
      className={cn("size-4 shrink-0 text-current", className)}
      aria-hidden={ariaHidden}
      strokeWidth={1.75}
    />
  )
}
