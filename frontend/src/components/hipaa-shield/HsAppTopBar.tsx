"use client"

import { useRouter } from "next/navigation"
import { Menu } from "lucide-react"
import { HsIcon } from "@/components/hipaa-shield/HsIcon"
import { HsGlobalSearch } from "@/components/hipaa-shield/HsGlobalSearch"
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton"
import { HsNotificationsBell } from "@/components/hipaa-shield/HsNotificationsBell"
import { HsUserMenu } from "@/components/hipaa-shield/HsUserMenu"
import { useDashboardRbac } from "@/lib/rbac/context"
import { cn } from "@/lib/utils"

export type HsAppTopBarProps = {
  pageTitle: string
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  criticalAlerts: number
  onOpenMobileNav?: () => void
  userName: string
  userRole: string
  userInitials: string
  onProfile?: () => void
  onSettings?: () => void
  onLogout: () => void
  runScanHref?: string
  className?: string
}

/**
 * Persistent top chrome for the compliance workspace.
 */
export function HsAppTopBar({
  pageTitle,
  searchQuery,
  onSearchQueryChange,
  criticalAlerts,
  onOpenMobileNav,
  userName,
  userRole,
  userInitials,
  onProfile,
  onSettings,
  onLogout,
  runScanHref = "/dashboard/phi-leakage-scanner",
  className,
}: HsAppTopBarProps) {
  const router = useRouter()
  const rbac = useDashboardRbac()
  const canRunScan = rbac.canWritePage("phi_leakage_scanner")

  return (
    <header
      className={cn(
        "flex h-16 w-full shrink-0 items-center gap-4 border-b border-hs-border bg-hs-card px-4 md:px-6",
        className,
      )}
    >
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-hs text-hs-muted md:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <HsIcon icon={Menu} />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-hs-title font-semibold text-hs-text md:flex-none">
        {pageTitle}
      </h1>
      <div className="ml-auto flex items-center gap-3">
        <HsGlobalSearch value={searchQuery} onChange={onSearchQueryChange} />
        <div className="hidden h-6 w-px bg-hs-border md:block" aria-hidden />
        {canRunScan ? (
          <>
            <HsPrimaryButton
              type="button"
              className="hidden whitespace-nowrap sm:inline-flex"
              onClick={() => router.push(runScanHref)}
            >
              Run Scan
            </HsPrimaryButton>
            <HsPrimaryButton
              type="button"
              className="px-3 sm:hidden"
              onClick={() => router.push(runScanHref)}
            >
              Scan
            </HsPrimaryButton>
          </>
        ) : null}
        <HsNotificationsBell criticalCount={criticalAlerts} />
        <HsUserMenu
          name={userName}
          role={userRole}
          initials={userInitials}
          onProfile={onProfile}
          onSettings={onSettings}
          onLogout={onLogout}
        />
      </div>
    </header>
  )
}
