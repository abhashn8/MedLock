import { cn } from "@/lib/utils"

export type HsSkeletonProps = {
  className?: string
  /** When true, shows as rounded block for text lines */
  rounded?: "none" | "sm" | "md" | "full"
}

/**
 * Page-level loading placeholders. Prefer over spinners for full views.
 */
export function HsSkeleton({
  className,
  rounded = "sm",
}: HsSkeletonProps) {
  return (
    <div
      className={cn(
        "hs-shimmer-bg",
        rounded === "none" && "rounded-none",
        rounded === "sm" && "rounded-hs",
        rounded === "md" && "rounded-hs-card",
        rounded === "full" && "rounded-full",
        className,
      )}
      aria-hidden
    />
  )
}
