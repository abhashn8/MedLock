"use client"

import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export type HsModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/**
 * Confirmations and short forms. Overlay + panel with motion per spec.
 */
export function HsModal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: HsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-hs-overlay px-6 py-8"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "w-full max-w-[560px] rounded-hs-card border border-hs-border bg-hs-card shadow-hs-modal",
          "translate-y-0 opacity-100 transition-[opacity,transform] duration-200 ease-out",
          className,
        )}
      >
        <div className="flex items-start justify-between border-b border-hs-border px-6 py-6">
          <h2 id={titleId} className="text-hs-section font-semibold text-hs-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-hs-muted hs-transition-border hover:bg-hs-fill focus-visible:outline-none focus-visible:shadow-hs-focus"
          >
            <span className="text-[20px] leading-none">×</span>
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-3 border-t border-hs-border px-6 py-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
