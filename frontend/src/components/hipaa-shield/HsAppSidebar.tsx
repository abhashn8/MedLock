"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { HsIcon } from "@/components/hipaa-shield/HsIcon"
import { HsTooltip } from "@/components/hipaa-shield/HsTooltip"
import { dashboardNavSections } from "@/app/dashboard/nav.config"
import { canAccess, pageForRoute, type Role } from "@/lib/rbac/permissions"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "hs-sidebar-collapsed"

export type HsAppSidebarProps = {
  activeHref: string | null
  collapsed: boolean
  onToggleCollapsed: () => void
  userName: string
  userRole: string
  role?: Role | null
  className?: string
}

/**
 * Primary workspace navigation with section grouping and collapse behavior.
 */
export function HsAppSidebar({
  activeHref,
  collapsed,
  onToggleCollapsed,
  userName,
  userRole,
  role,
  className,
}: HsAppSidebarProps) {
  const pathname = usePathname()
  const sections = dashboardNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const page = pageForRoute(item.href)
        return !page || !role || canAccess(role, page)
      }),
    }))
    .filter((section) => section.items.length > 0)

  function isActive(href: string): boolean {
    if (!activeHref) return false
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return activeHref === href
  }

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-hs-border bg-hs-card hs-transition-border",
        collapsed ? "w-16" : "w-60",
        className,
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-hs-border px-3">
        {!collapsed ? (
          <Link
            href="/dashboard"
            className="truncate text-hs-section font-semibold text-hs-primary"
          >
            MedLock
          </Link>
        ) : (
          <Link
            href="/dashboard"
            className="mx-auto flex size-9 items-center justify-center rounded-hs bg-hs-info-bg text-hs-caption font-semibold text-hs-primary"
            title="MedLock"
          >
            ML
          </Link>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "hidden rounded-hs p-1.5 text-hs-muted hover:bg-hs-fill-hover lg:inline-flex",
            collapsed && "mx-auto",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <HsIcon icon={collapsed ? ChevronRight : ChevronLeft} />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {sections.map((section) => (
          <div key={section.id} className="mb-2">
            {!collapsed ? (
              <p className="mb-2 mt-6 px-3 text-hs-nav-section font-medium uppercase tracking-[0.08em] text-hs-placeholder first:mt-0">
                {section.label}
              </p>
            ) : (
              <div className="my-3 h-px bg-hs-border" aria-hidden />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                const inner = (
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex h-10 items-center gap-2 rounded-hs py-2.5 pl-4 pr-3 text-hs-secondary font-medium",
                      active
                        ? "bg-hs-info-bg text-hs-primary"
                        : "text-[#374151] hover:bg-hs-fill-hover",
                      collapsed && "relative justify-center px-0",
                    )}
                  >
                    <HsIcon
                      icon={item.icon}
                      className={active ? "text-hs-primary" : "text-hs-muted group-hover:text-hs-text"}
                    />
                    {!collapsed ? (
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    ) : null}
                    {!collapsed && item.badgeCount ? (
                      <span className="flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-hs-danger px-1 text-[11px] font-medium leading-none text-white">
                        {item.badgeCount > 99 ? "99+" : item.badgeCount}
                      </span>
                    ) : null}
                    {!collapsed && item.badgeDot && !item.badgeCount ? (
                      <span className="size-2 shrink-0 rounded-full bg-hs-danger" title="Critical alerts" />
                    ) : null}
                    {collapsed && (item.badgeCount || item.badgeDot) ? (
                      <span
                        className={cn(
                          "absolute right-0.5 top-0.5 flex items-center justify-center rounded-full bg-hs-danger font-medium leading-none text-white",
                          item.badgeCount
                            ? "min-h-[14px] min-w-[14px] px-0.5 text-[9px]"
                            : "size-2",
                        )}
                        aria-hidden
                      >
                        {item.badgeCount
                          ? item.badgeCount > 99
                            ? "99+"
                            : item.badgeCount
                          : null}
                      </span>
                    ) : null}
                  </Link>
                )

                return (
                  <li key={item.href} className="relative">
                    {collapsed ? (
                      <HsTooltip content={item.label}>{inner}</HsTooltip>
                    ) : (
                      inner
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-hs-border p-3">
        {!collapsed ? (
          <>
            <p className="truncate text-hs-secondary font-medium text-hs-text">{userName}</p>
            <p className="truncate text-hs-caption font-normal text-hs-muted">{userRole}</p>
            <a
              href="https://www.hhs.gov/hipaa/for-professionals/privacy/index.html"
              className="mt-3 block text-hs-secondary font-medium text-hs-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Get Help
            </a>
            <p className="mt-2 text-hs-caption font-normal text-hs-placeholder">
              45 CFR Parts 160 &amp; 164
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <HsTooltip content="Get Help">
              <a
                href="https://www.hhs.gov/hipaa/for-professionals/privacy/index.html"
                className="flex size-9 items-center justify-center rounded-hs text-hs-primary hover:bg-hs-fill-hover"
                target="_blank"
                rel="noreferrer"
                aria-label="Get Help"
              >
                ?
              </a>
            </HsTooltip>
            <HsTooltip content="45 CFR Parts 160 & 164">
              <span className="text-[10px] font-medium text-hs-placeholder">CFR</span>
            </HsTooltip>
          </div>
        )}
      </div>
    </aside>
  )
}

export function readInitialSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(STORAGE_KEY) === "1"
}

export function persistSidebarCollapsed(collapsed: boolean) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0")
}
