"use client"

import { Bell } from "lucide-react"
import { HsIcon } from "@/components/hipaa-shield/HsIcon"
import { cn } from "@/lib/utils"

export type HsNotificationsBellProps = {
  criticalCount: number
  onClick?: () => void
  className?: string
}

/**
 * Critical alert entry point in the top bar.
 */
export function HsNotificationsBell({
  criticalCount,
  onClick,
  className,
}: HsNotificationsBellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex size-10 items-center justify-center rounded-hs text-hs-muted hs-transition-border hover:bg-hs-fill-hover focus-visible:outline-none focus-visible:shadow-hs-focus",
        className,
      )}
      aria-label={`Notifications, ${criticalCount} critical`}
    >
      <HsIcon icon={Bell} />
      {criticalCount > 0 ? (
        <span className="absolute right-1 top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-hs-danger px-1 text-[11px] font-medium leading-none text-white">
          {criticalCount > 99 ? "99+" : criticalCount}
        </span>
      ) : null}
    </button>
  )
}
