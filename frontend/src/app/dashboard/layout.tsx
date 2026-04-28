"use client"

import { HsDashboardShell } from "@/components/hipaa-shield/HsDashboardShell"
import { DashboardRbacProvider } from "@/lib/rbac/context"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardRbacProvider>
      <HsDashboardShell>{children}</HsDashboardShell>
    </DashboardRbacProvider>
  )
}
