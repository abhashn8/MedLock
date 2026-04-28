"use client"

import { Search } from "lucide-react"
import { HsIcon } from "@/components/hipaa-shield/HsIcon"
import { cn } from "@/lib/utils"

export type HsGlobalSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * Global search across findings, vendors, staff, and incidents (wire to API later).
 */
export function HsGlobalSearch({
  value,
  onChange,
  placeholder = "Search findings, vendors, staff…",
  className,
}: HsGlobalSearchProps) {
  return (
    <div
      className={cn(
        "relative hidden w-[280px] shrink-0 md:block",
        className,
      )}
    >
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hs-placeholder">
        <HsIcon icon={Search} className="text-hs-placeholder" />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-hs border border-hs-border bg-hs-card py-0 pl-9 pr-3 text-hs-body font-normal text-hs-text placeholder:text-hs-placeholder",
          "hs-transition-border focus:border-hs-primary focus:outline-none focus:shadow-hs-focus focus:ring-0",
        )}
        aria-label="Global search"
      />
    </div>
  )
}
