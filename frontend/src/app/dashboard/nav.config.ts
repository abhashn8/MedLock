import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Archive,
  Bell,
  BookOpen,
  Building2,
  ClipboardCheck,
  Database,
  FileOutput,
  FileWarning,
  Fingerprint,
  GraduationCap,
  Handshake,
  History,
  KeyRound,
  LayoutDashboard,
  Library,
  LineChart,
  Mail,
  Network,
  Package,
  Plug,
  ScanSearch,
  ScrollText,
  Share2,
  Sparkles,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react"

export type DashboardNavItem = {
  href: string
  label: string
  icon: LucideIcon
  badgeCount?: number
  badgeDot?: boolean
}

export type DashboardNavSection = {
  id: string
  label: string
  items: DashboardNavItem[]
}

/**
 * Full left-rail information architecture for MedLock.
 */
export const dashboardNavSections: DashboardNavSection[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badgeDot: true },
      {
        href: "/dashboard/compliance-score-trend",
        label: "Compliance Score Trend",
        icon: LineChart,
      },
    ],
  },
  {
    id: "phi",
    label: "PHI Protection",
    items: [
      {
        href: "/dashboard/phi-leakage-scanner",
        label: "PHI Leakage Scanner",
        icon: ScanSearch,
        badgeCount: 3,
      },
      { href: "/dashboard/phi-inventory", label: "PHI Inventory", icon: Database },
      {
        href: "/dashboard/de-identification-checker",
        label: "De-identification Checker",
        icon: Fingerprint,
      },
    ],
  },
  {
    id: "access",
    label: "Access & Identity",
    items: [
      {
        href: "/dashboard/access-control-settings",
        label: "Access Control Settings",
        icon: KeyRound,
      },
      { href: "/dashboard/role-management", label: "Role Management", icon: Users },
      {
        href: "/dashboard/user-access-review",
        label: "User Access Review",
        icon: ClipboardCheck,
        badgeCount: 12,
      },
    ],
  },
  {
    id: "security",
    label: "Security Controls",
    items: [
      { href: "/dashboard/audit-log-viewer", label: "Audit Log Viewer", icon: ScrollText },
      {
        href: "/dashboard/anomaly-alerts",
        label: "Anomaly Alerts",
        icon: Sparkles,
        badgeDot: true,
      },
      {
        href: "/dashboard/network-transmission-security",
        label: "Network & Transmission Security",
        icon: Network,
      },
    ],
  },
  {
    id: "risk",
    label: "Risk & Compliance",
    items: [
      { href: "/dashboard/risk-assessment", label: "Risk Assessment", icon: FileWarning },
      { href: "/dashboard/policy-library", label: "Policy Library", icon: BookOpen },
    ],
  },
  {
    id: "vendors",
    label: "Vendors & Partners",
    items: [
      {
        href: "/dashboard/baa-tracker",
        label: "BAA Tracker",
        icon: Handshake,
        badgeCount: 2,
      },
      {
        href: "/dashboard/vendor-risk-scores",
        label: "Vendor Risk Scores",
        icon: TrendingUp,
      },
      {
        href: "/dashboard/subcontractor-register",
        label: "Subcontractor Register",
        icon: Share2,
      },
    ],
  },
  {
    id: "workforce",
    label: "Workforce",
    items: [
      {
        href: "/dashboard/training-tracker",
        label: "Training Tracker",
        icon: GraduationCap,
        badgeCount: 5,
      },
      {
        href: "/dashboard/training-course-library",
        label: "Training Course Library",
        icon: Library,
      },
    ],
  },
  {
    id: "incidents",
    label: "Incidents & Breach",
    items: [
      {
        href: "/dashboard/active-incidents",
        label: "Active Incidents",
        icon: Activity,
        badgeDot: true,
      },
      {
        href: "/dashboard/breach-notification-center",
        label: "Breach Notification Center",
        icon: Mail,
      },
      { href: "/dashboard/incident-history", label: "Incident History", icon: History },
    ],
  },
  {
    id: "reports",
    label: "Reports & Audit",
    items: [
      { href: "/dashboard/report-generator", label: "Report Generator", icon: FileOutput },
      { href: "/dashboard/audit-packages", label: "Audit Packages", icon: Package },
      {
        href: "/dashboard/previous-reports-archive",
        label: "Previous Reports Archive",
        icon: Archive,
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        href: "/dashboard/organization-profile",
        label: "Organization Profile",
        icon: Building2,
      },
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
      {
        href: "/dashboard/notification-preferences",
        label: "Notification Preferences",
        icon: Bell,
      },
      { href: "/dashboard/user-management", label: "User Management", icon: UserCog },
    ],
  },
]

export function flattenDashboardNav(): DashboardNavItem[] {
  return dashboardNavSections.flatMap((s) => s.items)
}
