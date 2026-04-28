"use client"

import React from "react"
import Link from "next/link"
import { Shield } from "lucide-react"
import { HsIcon } from "@/components/hipaa-shield/HsIcon"
import { cn } from "@/lib/utils"

export function Header() {
  const [open, setOpen] = React.useState(false)
  const scrolled = useScroll(10)

  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-hs-border bg-hs-card",
        scrolled && "bg-hs-card",
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-hs px-2 py-1 text-hs-body font-medium text-hs-text hs-transition-border hover:bg-hs-fill-hover"
        >
          <HsIcon icon={Shield} className="text-hs-primary" />
          <span>MedLock</span>
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          <a
            href="#product"
            className="text-hs-secondary font-medium text-hs-muted hover:text-hs-text"
          >
            Product
          </a>
          <a
            href="#security"
            className="text-hs-secondary font-medium text-hs-muted hover:text-hs-text"
          >
            Security
          </a>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-hs border border-hs-border bg-hs-card px-3 text-hs-secondary font-medium text-[#374151]",
                "hs-transition-button-bg hover:bg-hs-fill-hover focus-visible:outline-none focus-visible:shadow-hs-focus",
              )}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-hs border border-transparent bg-hs-primary px-3 text-hs-secondary font-medium text-white",
                "hs-transition-button-bg hover:bg-hs-primary-hover active:scale-[0.98] active:bg-hs-primary-active",
                "focus-visible:outline-none focus-visible:shadow-hs-focus",
              )}
            >
              Get started
            </Link>
          </div>
        </div>
        <button
          type="button"
          className="rounded-hs border border-hs-border px-3 py-2 text-hs-caption font-medium text-hs-muted md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>
      </nav>
      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-hs-border bg-hs-card px-4 py-4 md:hidden"
        >
          <div className="flex flex-col gap-3">
            <a href="#product" className="text-hs-body font-medium text-hs-text">
              Product
            </a>
            <a href="#security" className="text-hs-body font-medium text-hs-text">
              Security
            </a>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={cn(
                "inline-flex h-10 w-full items-center justify-center rounded-hs border border-hs-border bg-hs-card text-hs-body font-medium text-[#374151]",
                "hover:bg-hs-fill-hover",
              )}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className={cn(
                "inline-flex h-10 w-full items-center justify-center rounded-hs bg-hs-primary text-hs-body font-medium text-white",
                "hover:bg-hs-primary-hover",
              )}
            >
              Get started
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  )
}

function useScroll(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false)

  const onScroll = React.useCallback(() => {
    setScrolled(window.scrollY > threshold)
  }, [threshold])

  React.useEffect(() => {
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [onScroll])

  React.useEffect(() => {
    onScroll()
  }, [onScroll])

  return scrolled
}
