"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getDashboardNavContext } from "@/app/dashboard/nav-resolver"
import { HsAppSidebar, persistSidebarCollapsed, readInitialSidebarCollapsed } from "@/components/hipaa-shield/HsAppSidebar"
import { HsAppTopBar } from "@/components/hipaa-shield/HsAppTopBar"
import { cn } from "@/lib/utils"

export type HsDashboardShellProps = {
  children: React.ReactNode
}

/**
 * Authenticated dashboard frame: sidebar, top bar, responsive drawer, scroll region.
 */
export function HsDashboardShell({ children }: HsDashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { title, activeHref } = getDashboardNavContext(pathname)

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [userName, setUserName] = useState("User")
  const [userRole, setUserRole] = useState("Compliance Manager")

  useEffect(() => {
    setCollapsed(readInitialSidebarCollapsed())
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled || !user) return
      const meta = user.user_metadata as { full_name?: string; name?: string }
      const name =
        meta?.full_name ??
        meta?.name ??
        user.email?.split("@")[0] ??
        "User"
      setUserName(name)
      const role =
        (user.app_metadata as { role?: string })?.role ??
        "Compliance Manager"
      setUserRole(role)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false)
    }
    if (mobileOpen) document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      persistSidebarCollapsed(next)
      return next
    })
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const initials = userName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex h-screen min-h-0 w-full bg-hs-page">
      <div className="hidden h-full lg:flex">
        <HsAppSidebar
          activeHref={activeHref}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          userName={userName}
          userRole={userRole}
        />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-hs-overlay"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-50 w-60 shadow-hs-modal">
            <HsAppSidebar
              activeHref={activeHref}
              collapsed={false}
              onToggleCollapsed={() => {}}
              userName={userName}
              userRole={userRole}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <HsAppTopBar
          pageTitle={title}
          searchQuery={search}
          onSearchQueryChange={setSearch}
          criticalAlerts={4}
          onOpenMobileNav={() => setMobileOpen(true)}
          userName={userName}
          userRole={userRole}
          userInitials={initials}
          onProfile={() => router.push("/dashboard/organization-profile")}
          onSettings={() => router.push("/dashboard/notification-preferences")}
          onLogout={handleLogout}
        />
        <main className={cn("min-h-0 flex-1 overflow-y-auto")}>{children}</main>
      </div>
    </div>
  )
}
