"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export type HsDropdownMenuProps = {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: "left" | "right"
  className?: string
}

/**
 * Compact menus: user avatar, overflow actions. Closes on outside click or Escape.
 */
export function HsDropdownMenu({
  trigger,
  children,
  align = "right",
  className,
}: HsDropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onDocMouseDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const toggle = () => {
    if (!open && rootRef.current) {
      const r = rootRef.current.getBoundingClientRect()
      setPos({
        top: r.bottom + window.scrollY + 8,
        left:
          align === "right"
            ? r.right + window.scrollX
            : r.left + window.scrollX,
      })
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        className="inline-flex"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={toggle}
      >
        {trigger}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                transform: align === "right" ? "translateX(-100%)" : undefined,
                minWidth: 220,
              }}
              className={cn(
                "z-[100] rounded-hs-menu border border-hs-border bg-hs-card py-2 shadow-hs-dropdown",
                className,
              )}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export type HsDropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function HsDropdownMenuItem({
  className,
  children,
  ...props
}: HsDropdownMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 px-4 py-2 text-left text-hs-body font-normal text-hs-text hover:bg-hs-fill-hover",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
