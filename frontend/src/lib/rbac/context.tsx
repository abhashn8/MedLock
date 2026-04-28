"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentRole } from "@/lib/api/roles";
import {
  can,
  canAccess,
  canWrite,
  type NavPage,
  type Permission,
  ROLE_DETAILS,
  type Role,
} from "@/lib/rbac/permissions";

type DashboardRbacContextValue = {
  role: Role | null;
  roleLabel: string;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  permissionFor: (page: NavPage) => Permission;
  canAccessPage: (page: NavPage) => boolean;
  canWritePage: (page: NavPage) => boolean;
};

const DashboardRbacContext = createContext<DashboardRbacContextValue | null>(null);

export function DashboardRbacProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const current = await getCurrentRole();
      setRole(current.role);
      setIsOwner(current.is_owner);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load role.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const value = useMemo<DashboardRbacContextValue>(
    () => ({
      role,
      roleLabel: role ? ROLE_DETAILS[role].label : "Loading role",
      isOwner,
      loading,
      error,
      reload,
      permissionFor: (page) => (role ? can(role, page) : "none"),
      canAccessPage: (page) => (role ? canAccess(role, page) : false),
      canWritePage: (page) => (role ? canWrite(role, page) : false),
    }),
    [error, isOwner, loading, role],
  );

  return (
    <DashboardRbacContext.Provider value={value}>
      {children}
    </DashboardRbacContext.Provider>
  );
}

export function useDashboardRbac() {
  const context = useContext(DashboardRbacContext);
  if (!context) {
    throw new Error("useDashboardRbac must be used within DashboardRbacProvider");
  }
  return context;
}
