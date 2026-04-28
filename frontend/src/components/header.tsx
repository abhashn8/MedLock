"use client"

import React from "react"
import Link from "next/link"
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
        "sticky top-0 z-50 w-full transition-colors",
        scrolled
          ? "border-b border-slate-900/80 bg-[var(--ml-bg)]/80 backdrop-blur-lg"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-100"
        >
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10">
            <span
              className="absolute inset-0 rounded-md bg-cyan-400/20 blur"
              aria-hidden
            />
            <i
              className="fa-solid fa-shield-halved relative text-[13px] text-cyan-300"
              aria-hidden
            />
          </span>
          MedLock
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#how-it-works"
            className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-100"
          >
            How it works
          </a>
          <a
            href="#features"
            className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-100"
          >
            Features
          </a>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_18px_rgba(34,211,238,0.35)] transition-all hover:bg-cyan-300 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.4),0_0_28px_rgba(34,211,238,0.55)]"
            >
              Get Started
            </Link>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-300 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </nav>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-slate-900/80 bg-[var(--ml-bg)]/95 px-4 py-4 backdrop-blur-lg md:hidden"
        >
          <div className="flex flex-col gap-2">
            <a
              href="#how-it-works"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
            >
              How it works
            </a>
            <a
              href="#features"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
            >
              Features
            </a>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-800 text-sm font-semibold text-slate-200 hover:bg-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-cyan-400 text-sm font-semibold text-slate-950"
            >
              Get Started
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
