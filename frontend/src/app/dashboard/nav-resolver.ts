import { flattenDashboardNav } from "@/app/dashboard/nav.config"

/**
 * Resolves shell title and which nav href should show active styling.
 */
export function getDashboardNavContext(pathname: string): {
  title: string
  activeHref: string | null
} {
  if (pathname === "/dashboard") {
    return { title: "Dashboard", activeHref: "/dashboard" }
  }

  if (pathname.startsWith("/dashboard/report")) {
    return {
      title: "PHI scan report",
      activeHref: "/dashboard/phi-leakage-scanner",
    }
  }

  const items = flattenDashboardNav()
  let best: { href: string; label: string } | null = null

  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.href.length) {
        best = { href: item.href, label: item.label }
      }
    }
  }

  if (best) {
    return { title: best.label, activeHref: best.href }
  }

  return { title: "MedLock", activeHref: null }
}
