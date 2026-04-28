import { HsDashboardShell } from "@/components/hipaa-shield/HsDashboardShell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <HsDashboardShell>{children}</HsDashboardShell>
}
