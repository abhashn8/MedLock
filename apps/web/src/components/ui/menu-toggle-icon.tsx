"use client"

import { cn } from "@/lib/utils"

interface MenuToggleIconProps extends React.SVGProps<SVGSVGElement> {
  open: boolean
  duration?: number
}

export function MenuToggleIcon({
  open,
  duration = 300,
  className,
  ...props
}: MenuToggleIconProps) {
  const style = { transitionDuration: `${duration}ms` }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5", className)}
      {...props}
    >
      <line
        x1="4"
        y1="6"
        x2="20"
        y2="6"
        className={cn(
          "origin-center transition-transform",
          open && "translate-y-[6px] rotate-45"
        )}
        style={style}
      />
      <line
        x1="4"
        y1="12"
        x2="20"
        y2="12"
        className={cn("transition-opacity", open && "opacity-0")}
        style={style}
      />
      <line
        x1="4"
        y1="18"
        x2="20"
        y2="18"
        className={cn(
          "origin-center transition-transform",
          open && "-translate-y-[6px] -rotate-45"
        )}
        style={style}
      />
    </svg>
  )
}
