"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCcw, ShieldCheck } from "lucide-react";
import {
  deleteRoleMember,
  getRoleChangelog,
  getRoleInvitations,
  getRoleMembers,
  patchRoleMember,
  type RoleChangeLogRow,
  type RoleMember,
} from "@/lib/api/roles";
import {
  PAGE_LABELS,
  PERMISSIONS,
  ROLE_DETAILS,
  ROLES,
  type NavPage,
  type Permission,
  type Role,
} from "@/lib/rbac/permissions";
import { useDashboardRbac } from "@/lib/rbac/context";
import { HsAlertBanner } from "@/components/hipaa-shield/HsAlertBanner";
import { HsDangerButton } from "@/components/hipaa-shield/HsDangerButton";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsReadOnlyBanner } from "@/components/hipaa-shield/HsReadOnlyBanner";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { cn } from "@/lib/utils";

const roleStyles: Record<Role, string> = {
  admin: "border-purple-200 bg-purple-50 text-purple-700",
  privacy_officer: "border-teal-200 bg-teal-50 text-teal-700",
  security_officer: "border-red-200 bg-red-50 text-red-700",
  compliance_manager: "border-blue-200 bg-blue-50 text-blue-700",
  auditor: "border-amber-200 bg-amber-50 text-amber-700",
  data_analyst: "border-gray-200 bg-gray-50 text-gray-700",
  developer: "border-pink-200 bg-pink-50 text-pink-700",
};

const permissionStyles: Record<Permission, string> = {
  full: "border-hs-success-border bg-hs-success-bg text-hs-success",
  read_only: "border-hs-border bg-hs-fill text-hs-muted",
  none: "border-transparent bg-transparent text-hs-placeholder",
};

const ACCESS_CONTROL_PAGES: NavPage[] = [
  "role_management",
  "user_access_review",
  "access_control_settings",
];

function friendlyError(message: string) {
  if (message === "Failed to fetch" || message.toLowerCase().includes("fetch")) {
    return "Access control data is unavailable because the backend API is not reachable. Start backend on port 4000 and refresh.";
  }
  return message;
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "Never";
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function initials(member: Pick<RoleMember, "full_name" | "email">) {
  const source = member.full_name?.trim() || member.email?.split("@")[0] || "?";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StatCard({ label, value, context }: { label: string; value: string; context: string }) {
  return (
    <div className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm">
      <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{value}</p>
      <p className="mt-1 text-hs-caption text-hs-muted">{context}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={cn("inline-flex rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium", roleStyles[role])}>
      {ROLE_DETAILS[role].label}
    </span>
  );
}

function PermissionPill({ permission }: { permission: Permission }) {
  return (
    <span className={cn("inline-flex rounded-hs-pill border px-2 py-0.5 text-[11px] font-medium capitalize", permissionStyles[permission])}>
      {permission.replace("_", " ")}
    </span>
  );
}

export default function AccessControlSettingsPage() {
  const rbac = useDashboardRbac();
  const canWriteAccess = rbac.canWritePage("access_control_settings");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [members, setMembers] = useState<RoleMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [changelog, setChangelog] = useState<RoleChangeLogRow[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  async function load() {
    setError(null);
    try {
      const [memberRows, inviteRows, logRows] = await Promise.all([
        getRoleMembers(),
        getRoleInvitations(),
        getRoleChangelog(1, 10),
      ]);
      setMembers(memberRows);
      setPendingInvites(inviteRows.length);
      setChangelog(logRows.rows);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Failed to load access control settings."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return members.filter((member) => {
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      if (statusFilter !== "all" && member.status !== statusFilter) return false;
      if (!normalized) return true;
      const haystack = `${member.full_name ?? ""} ${member.email ?? ""} ${member.department ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [members, query, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = members.filter((member) => member.status === "active").length;
    const suspended = members.filter((member) => member.status === "suspended").length;
    const admins = members.filter((member) => member.role === "admin").length;
    const newest = changelog[0]?.created_at ?? null;
    return { active, suspended, admins, newest };
  }, [members, changelog]);

  async function changeRole(member: RoleMember, role: Role) {
    if (!canWriteAccess || member.role === role) return;
    setSavingId(member.id);
    setError(null);
    setSuccess(null);
    try {
      await patchRoleMember(member.id, {
        role,
        reason: "Access Control Settings role update",
      });
      await load();
      setSuccess(`Updated ${member.full_name ?? member.email ?? "member"} to ${ROLE_DETAILS[role].label}.`);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Could not update role."));
    } finally {
      setSavingId(null);
    }
  }

  async function toggleStatus(member: RoleMember) {
    if (!canWriteAccess) return;
    setSavingId(member.id);
    setError(null);
    setSuccess(null);
    try {
      const nextStatus = member.status === "active" ? "suspended" : "active";
      await patchRoleMember(member.id, {
        status: nextStatus,
        reason: "Access Control Settings status update",
      });
      await load();
      setSuccess(nextStatus === "active" ? "Member reactivated." : "Member suspended.");
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Could not update member status."));
    } finally {
      setSavingId(null);
    }
  }

  async function removeMember(member: RoleMember) {
    if (!canWriteAccess) return;
    setSavingId(member.id);
    setError(null);
    setSuccess(null);
    try {
      await deleteRoleMember(member.id);
      await load();
      setSuccess("Member removed from organization.");
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Could not remove member."));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1320px] space-y-8">
        {rbac.permissionFor("access_control_settings") === "read_only" ? <HsReadOnlyBanner /> : null}
        {error ? (
          <HsAlertBanner variant="WARNING" onDismiss={() => setError(null)}>
            <span className="font-medium">Access control update failed:</span> {error}
          </HsAlertBanner>
        ) : null}
        {success ? (
          <HsAlertBanner variant="INFO" onDismiss={() => setSuccess(null)}>
            <span className="font-medium">Saved:</span> {success}
          </HsAlertBanner>
        ) : null}

        <section className="overflow-hidden rounded-hs-card border border-hs-border bg-hs-card">
          <div className="bg-gradient-to-br from-hs-info-bg via-hs-card to-hs-card p-6 md:p-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-hs-caption font-semibold uppercase tracking-[0.1em] text-hs-primary">Access & Identity</p>
                <h1 className="mt-3 text-hs-title font-semibold text-hs-text">Access Control Settings</h1>
                <p className="mt-3 text-hs-body text-hs-muted">
                  Operate MedLock access governance from one place: monitor role distribution, apply guarded member changes, and audit enforcement outcomes.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ROLES.map((role) => (
                    <RoleBadge key={role} role={role} />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <HsSecondaryButton type="button" onClick={() => void load()} disabled={loading}>
                  <RefreshCcw className="mr-2 size-4" />
                  Refresh
                </HsSecondaryButton>
                <HsPrimaryButton type="button" disabled={!canWriteAccess}>
                  <ShieldCheck className="mr-2 size-4" />
                  Enforcement healthy
                </HsPrimaryButton>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="grid gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <HsSkeleton key={index} className="h-28 rounded-hs-card" />
            ))}
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-5">
            <StatCard label="Active members" value={String(stats.active)} context="Members with active access" />
            <StatCard label="Suspended members" value={String(stats.suspended)} context="Temporarily blocked users" />
            <StatCard label="Pending invites" value={String(pendingInvites)} context="Awaiting first login/signup" />
            <StatCard label="Admin count" value={String(stats.admins)} context="High-privilege assignments" />
            <StatCard label="Last role event" value={timeAgo(stats.newest)} context="Newest role change log entry" />
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-hs-section font-semibold text-hs-text">Member access grid</h2>
                <p className="mt-1 text-hs-caption text-hs-muted">Filter by role and status, then update member role/status inline with backend guardrails.</p>
              </div>
              <div className="grid w-full gap-2 md:w-auto md:grid-cols-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name or email"
                  className="h-10 rounded-hs border border-hs-border bg-hs-page px-3 text-sm text-hs-text outline-none ring-0 transition-colors focus:border-hs-primary"
                />
                <HsSelect value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | Role)} disabled={loading}>
                  <option value="all">All roles</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_DETAILS[role].label}
                    </option>
                  ))}
                </HsSelect>
                <HsSelect value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "active" | "suspended")} disabled={loading}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </HsSelect>
              </div>
            </div>

            {loading ? (
              <div className="mt-5 space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <HsSkeleton key={index} className="h-20 rounded-hs" />
                ))}
              </div>
            ) : visibleMembers.length === 0 ? (
              <div className="mt-6 rounded-hs border border-dashed border-hs-border bg-hs-page/70">
                <HsEmptyState title="No matching members" description="Try clearing filters or inviting members from Role Management." />
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {visibleMembers.map((member) => {
                  const disabled = !canWriteAccess || Boolean(savingId);
                  return (
                    <article key={member.id} className="rounded-hs border border-hs-border bg-hs-page/70 p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-hs-card text-hs-caption font-semibold text-hs-text">
                            {initials(member)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-hs-text">{member.full_name ?? member.email ?? "Unknown member"}</p>
                            <p className="truncate text-xs text-hs-muted">
                              {member.email ?? "No email"} {member.department ? `• ${member.department}` : ""} {member.is_owner ? "• Organization owner" : ""}
                            </p>
                          </div>
                        </div>

                        <div className="grid flex-1 gap-2 sm:grid-cols-3 xl:max-w-[700px]">
                          <HsSelect
                            value={member.role}
                            disabled={disabled}
                            onValueChange={(value) => void changeRole(member, value as Role)}
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_DETAILS[role].label}
                              </option>
                            ))}
                          </HsSelect>
                          <HsSecondaryButton type="button" onClick={() => void toggleStatus(member)} disabled={disabled}>
                            {member.status === "active" ? "Suspend" : "Reactivate"}
                          </HsSecondaryButton>
                          <HsDangerButton type="button" onClick={() => void removeMember(member)} disabled={disabled || member.is_owner}>
                            Remove
                          </HsDangerButton>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <RoleBadge role={member.role} />
                        <PermissionPill permission={member.status === "active" ? "full" : "read_only"} />
                        <span className="text-xs text-hs-muted">Last active: {timeAgo(member.last_active_at)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-4 text-hs-warning" />
                <div>
                  <h3 className="text-hs-section font-semibold text-hs-text">Privileged-role safeguards</h3>
                  <ul className="mt-2 space-y-2 text-sm text-hs-muted">
                    <li>Owners cannot be removed from the org.</li>
                    <li>You cannot change your own role from this screen.</li>
                    <li>Only owners can manage admin targets.</li>
                    <li>All actions are logged in immutable role change history.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
              <h3 className="text-hs-section font-semibold text-hs-text">Recent access events</h3>
              {loading ? (
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <HsSkeleton key={index} className="h-14 rounded-hs" />
                  ))}
                </div>
              ) : changelog.length === 0 ? (
                <p className="mt-3 text-sm text-hs-muted">No role events recorded yet.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {changelog.slice(0, 8).map((row) => (
                    <div key={row.id} className="rounded-hs border border-hs-border bg-hs-page/70 p-3">
                      <p className="text-sm font-medium text-hs-text">
                        {row.action.replaceAll("_", " ")} {row.target_email ? `for ${row.target_email}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-hs-muted">
                        {timeAgo(row.created_at)} {row.reason ? `• ${row.reason}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-hs-section font-semibold text-hs-text">Permission matrix snapshot</h2>
              <p className="mt-1 text-hs-caption text-hs-muted">Fixed MedLock RBAC policy for core access-governance pages.</p>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="h-12 border-b border-hs-fill bg-hs-page">
                  <th className="px-4 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Page</th>
                  {ROLES.map((role) => (
                    <th key={role} className="px-3 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                      {ROLE_DETAILS[role].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACCESS_CONTROL_PAGES.map((page) => (
                  <tr key={page} className="h-14 border-b border-hs-fill">
                    <td className="px-4 text-sm font-medium text-hs-text">{PAGE_LABELS[page]}</td>
                    {ROLES.map((role) => (
                      <td key={`${page}-${role}`} className="px-3">
                        <PermissionPill permission={PERMISSIONS[page][role]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
