"use client"

import React, { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export type HsTooltipProps = {
  content: React.ReactNode
  children: React.ReactElement
  /** ms before open; default 400 */
  openDelayMs?: number
  className?: string
}

/**
 * Dense hints for icon-only nav and truncated labels. Opens after hover delay.
 */
export function HsTooltip({
  content,
  children,
  openDelayMs = 400,
  className,
}: HsTooltipProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipId = useId()

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCoords({
      top: r.top + window.scrollY - 4 - 8,
      left: r.left + window.scrollX + r.width / 2,
    })
  }, [])

  const handleEnter = () => {
    clearTimer()
    timerRef.current = setTimeout(() => {
      updatePosition()
      setOpen(true)
    }, openDelayMs)
  }

  const handleLeave = () => {
    clearTimer()
    setOpen(false)
  }

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={() => {
          updatePosition()
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
      >
        {React.cloneElement(children, {
          "aria-describedby": open ? tipId : undefined,
        } as Record<string, unknown>)}
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              style={{
                position: "absolute",
                top: coords.top,
                left: coords.left,
                transform: "translate(-50%, -100%)",
              }}
              className={cn(
                "z-[100] max-w-xs whitespace-normal border border-hs-border bg-hs-card px-3 py-2 text-left text-hs-caption font-normal text-hs-text shadow-hs-dropdown",
                "rounded-[6px]",
                className,
              )}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
