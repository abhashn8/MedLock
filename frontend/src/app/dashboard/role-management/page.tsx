"use client";

import { useEffect, useMemo, useState } from "react";
import { dashboardNavSections } from "@/app/dashboard/nav.config";
import {
  deleteRoleMember,
  getRoleChangelog,
  getRoleInvitations,
  getRoleMembers,
  inviteRoleMember,
  patchRoleMember,
  type RoleChangeLogRow,
  type RoleInvitation,
  type RoleMember,
} from "@/lib/api/roles";
import {
  canAccess,
  canWrite,
  PAGE_LABELS,
  PERMISSIONS,
  ROLE_DETAILS,
  ROLES,
  pageForRoute,
  type NavPage,
  type Permission,
  type Role,
} from "@/lib/rbac/permissions";
import { HsAlertBanner } from "@/components/hipaa-shield/HsAlertBanner";
import { HsDangerButton } from "@/components/hipaa-shield/HsDangerButton";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { HsTextarea } from "@/components/hipaa-shield/HsTextarea";
import { cn } from "@/lib/utils";

const roleBadgeStyles: Record<Role, string> = {
  admin: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  privacy_officer: "border-teal-500/30 bg-teal-500/10 text-teal-300",
  security_officer: "border-red-500/30 bg-red-500/10 text-red-300",
  compliance_manager: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  auditor: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  data_analyst: "border-slate-700 bg-slate-800/40 text-slate-300",
  developer: "border-pink-500/30 bg-pink-500/10 text-pink-300",
};

const permissionStyles: Record<Permission, string> = {
  full: "border-hs-success-border bg-hs-success-bg text-hs-success",
  read_only: "border-hs-border bg-hs-fill text-hs-muted",
  none: "border-transparent bg-transparent text-hs-placeholder",
};

function friendlyError(message: string) {
  if (message === "Failed to fetch" || message.includes("fetch")) {
    return "Role data is unavailable because the backend API is not reachable. Start the backend on port 4000 and refresh.";
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

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function labelForRole(role: Role) {
  return ROLE_DETAILS[role].label;
}

function RoleBadge({
  role,
  active,
  onClick,
  className,
}: {
  role: Role;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <span
      className={cn(
        "inline-flex rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium",
        roleBadgeStyles[role],
        active && "ring-2 ring-hs-primary/40",
        className,
      )}
    >
      {labelForRole(role)}
    </span>
  );

  if (!onClick) return content;
  return (
    <button type="button" onClick={onClick} className="rounded-hs-pill focus-visible:outline-none focus-visible:shadow-hs-focus">
      {content}
    </button>
  );
}

function PermissionPill({ permission }: { permission: Permission }) {
  return (
    <span className={cn("inline-flex rounded-hs-pill border px-2 py-0.5 text-[11px] font-medium capitalize", permissionStyles[permission])}>
      {permission.replace("_", " ")}
    </span>
  );
}

function StatCard({
  label,
  value,
  context,
}: {
  label: string;
  value: string;
  context: string;
}) {
  return (
    <div className="rounded-hs-card border border-hs-border bg-hs-card p-5 shadow-sm hs-transition-border hover:border-hs-border-strong">
      <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-hs-text">{value}</p>
      <p className="mt-1 text-hs-caption text-hs-muted">{context}</p>
    </div>
  );
}

function getSectionPages(sectionId: string): NavPage[] {
  const section = dashboardNavSections.find((item) => item.id === sectionId);
  return (
    section?.items
      .map((item) => pageForRoute(item.href))
      .filter((page): page is NavPage => Boolean(page)) ?? []
  );
}

function sectionSummary(role: Role, sectionId: string) {
  const pages = getSectionPages(sectionId);
  const visible = pages.filter((page) => canAccess(role, page));
  const writable = pages.filter((page) => canWrite(role, page));
  return { pages, visible, writable };
}

function RoleAccessCard({ role }: { role: Role }) {
  const visiblePages = dashboardNavSections.flatMap((section) => sectionSummary(role, section.id).visible);
  const writablePages = visiblePages.filter((page) => canWrite(role, page));

  return (
    <div className={cn("rounded-hs-card border bg-hs-card p-5", roleBadgeStyles[role])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-hs-section font-semibold">{labelForRole(role)}</p>
          <p className="mt-1 max-w-xl text-hs-caption opacity-80">{ROLE_DETAILS[role].description}</p>
        </div>
        <div className="text-right text-hs-caption">
          <p className="font-medium">{visiblePages.length} visible pages</p>
          <p className="opacity-75">{writablePages.length} writable</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {dashboardNavSections.map((section) => {
          const summary = sectionSummary(role, section.id);
          if (summary.visible.length === 0) return null;
          return (
            <div key={section.id} className="rounded-hs border border-white/50 bg-white/55 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-hs-caption font-semibold text-hs-text">{section.label}</p>
                <span className="text-[11px] font-medium text-hs-muted">
                  {summary.visible.length}/{summary.pages.length}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {summary.visible.map((page) => (
                  <PermissionPill key={page} permission={PERMISSIONS[page][role]} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccessPreview({ role }: { role: Role }) {
  const visibleSections = dashboardNavSections
    .map((section) => ({ section, summary: sectionSummary(role, section.id) }))
    .filter((item) => item.summary.visible.length > 0);

  return (
    <div className="rounded-hs border border-hs-border bg-hs-page/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Access preview</p>
          <p className="mt-1 text-hs-caption text-hs-secondary">{ROLE_DETAILS[role].description}</p>
        </div>
        <RoleBadge role={role} />
      </div>
      <div className="mt-4 space-y-3">
        {visibleSections.map(({ section, summary }) => (
          <div key={section.id}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-hs-muted">{section.label}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {summary.visible.map((page) => (
                <span key={page} className="rounded-hs-pill bg-hs-card px-2 py-1 text-[11px] text-hs-text">
                  {PAGE_LABELS[page]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RoleManagementPage() {
  const [members, setMembers] = useState<RoleMember[]>([]);
  const [invitations, setInvitations] = useState<RoleInvitation[]>([]);
  const [changelog, setChangelog] = useState<RoleChangeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>("admin");
  const [form, setForm] = useState({ full_name: "", email: "", role: "auditor" as Role, notes: "" });

  async function load() {
    setError(null);
    try {
      const [memberRows, inviteRows, logResult] = await Promise.all([
        getRoleMembers(),
        getRoleInvitations(),
        getRoleChangelog(1, 20),
      ]);
      setMembers(memberRows);
      setInvitations(inviteRows);
      setChangelog(logResult.rows);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Failed to load role management."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === "active").length;
    const suspended = members.filter((m) => m.status === "suspended").length;
    return {
      active,
      suspended,
      pending: invitations.length,
      lastChange: changelog[0]?.created_at ? timeAgo(changelog[0].created_at) : "None",
    };
  }, [changelog, invitations.length, members]);

  async function submitInvite(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await inviteRoleMember(form);
      setSuccess(`Invite created for ${form.email}. They will auto-join after login or signup.`);
      setForm({ full_name: "", email: "", role: "auditor", notes: "" });
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Invite failed."));
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(member: RoleMember, role: Role) {
    if (member.role === role) return;
    setError(null);
    try {
      await patchRoleMember(member.id, { role, reason: "Role changed from Role Management" });
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Role update failed."));
    }
  }

  async function toggleSuspended(member: RoleMember) {
    const next = member.status === "suspended" ? "active" : "suspended";
    setError(null);
    try {
      await patchRoleMember(member.id, { status: next, reason: `Member ${next}` });
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Status update failed."));
    }
  }

  async function remove(member: RoleMember) {
    if (!window.confirm(`Remove ${member.full_name ?? member.email ?? "this member"} from the organization?`)) return;
    setError(null);
    try {
      await deleteRoleMember(member.id);
      await load();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Remove failed."));
    }
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <section className="overflow-hidden rounded-hs-card border border-hs-border bg-hs-card">
          <div className="bg-gradient-to-br from-hs-info-bg via-hs-card to-hs-card p-6 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-hs-caption font-semibold uppercase tracking-[0.1em] text-hs-primary">Access governance</p>
                <h1 className="mt-3 text-hs-title font-semibold text-hs-text">Role Management</h1>
                <p className="mt-3 text-hs-body text-hs-muted">
                  Invite team members into fixed HIPAA/SOC 2 roles, review their access surface, and maintain an append-only audit trail for every role change.
                </p>
              </div>
              <div className="grid gap-2 rounded-hs-card border border-hs-border bg-white/70 p-4 text-hs-caption text-hs-secondary sm:grid-cols-3 xl:min-w-[420px]">
                <div>
                  <p className="font-semibold text-hs-text">Fixed roles</p>
                  <p>Permissions are code-defined, not user-editable.</p>
                </div>
                <div>
                  <p className="font-semibold text-hs-text">No email send</p>
                  <p>Pending invite auto-joins on login/signup.</p>
                </div>
                <div>
                  <p className="font-semibold text-hs-text">Audit-ready</p>
                  <p>Every change is logged for review.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <HsAlertBanner variant="WARNING" onDismiss={() => setError(null)}>
            <span className="font-medium">Role data issue:</span> {error}
          </HsAlertBanner>
        ) : null}
        {success ? (
          <HsAlertBanner variant="INFO" onDismiss={() => setSuccess(null)}>
            <span className="font-medium">Success:</span> {success}
          </HsAlertBanner>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active members" value={loading ? "..." : String(stats.active)} context={`${stats.suspended} suspended`} />
          <StatCard label="Roles defined" value={String(ROLES.length)} context="Compliance-grade fixed roles" />
          <StatCard label="Pending invites" value={loading ? "..." : String(stats.pending)} context="Auto-join after auth" />
          <StatCard label="Last role change" value={stats.lastChange} context="Newest audit event" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submitInvite} className="space-y-5 rounded-hs-card border border-hs-border bg-hs-card p-6">
            <div>
              <h2 className="text-hs-section font-semibold text-hs-text">Invite member</h2>
              <p className="mt-1 text-hs-caption text-hs-muted">
                Create a pending invite by email. When that user logs in or signs up, they join this organization automatically.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <HsTextInput label="Full name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              <HsTextInput
                label="Email address"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <HsSelect
              label="Role"
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as Role;
                setForm((f) => ({ ...f, role }));
                setSelectedRole(role);
              }}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_DETAILS[role].label} - {ROLE_DETAILS[role].description}
                </option>
              ))}
            </HsSelect>
            <HsTextarea label="Personal note" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            <AccessPreview role={form.role} />
            <HsPrimaryButton type="submit" loading={saving} disabled={saving || Boolean(error && members.length === 0)}>
              Create pending invite
            </HsPrimaryButton>
          </form>

          <section className="space-y-4 rounded-hs-card border border-hs-border bg-hs-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-hs-section font-semibold text-hs-text">Permission preview</h2>
                <p className="mt-1 max-w-2xl text-hs-caption text-hs-muted">
                  Permissions are fixed in code. Select a role to see the dashboard sections it can access and which pages are writable.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => (
                  <RoleBadge key={role} role={role} active={selectedRole === role} onClick={() => setSelectedRole(role)} />
                ))}
              </div>
            </div>
            <RoleAccessCard role={selectedRole} />
          </section>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-hs-section font-semibold text-hs-text">Members</h2>
              <p className="mt-1 text-hs-caption text-hs-muted">Active and suspended organization memberships.</p>
            </div>
            <HsSecondaryButton type="button" onClick={() => void load()}>
              Refresh
            </HsSecondaryButton>
          </div>

          {loading ? (
            <div className="mt-5 grid gap-3">{Array.from({ length: 4 }).map((_, i) => <HsSkeleton key={i} className="h-20 w-full" />)}</div>
          ) : members.length === 0 ? (
            <div className="mt-5 rounded-hs border border-dashed border-hs-border">
              <HsEmptyState title="No members loaded" description="Once the backend is reachable and you have admin access, members will appear here." />
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {members.map((member) => (
                <div key={member.id} className="rounded-hs border border-hs-border bg-hs-page/50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-hs-info-bg text-hs-body font-semibold text-hs-primary">
                        {initials(member.full_name, member.email)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-hs-text">{member.full_name ?? member.email ?? "Unknown member"}</p>
                          {member.is_owner ? <span className="rounded-hs-pill bg-hs-fill px-2 py-0.5 text-[11px] font-medium text-hs-muted">Owner</span> : null}
                          <span className={cn("rounded-hs-pill px-2 py-0.5 text-[11px] font-medium", member.status === "active" ? "bg-hs-success-bg text-hs-success" : "bg-hs-danger-bg text-hs-danger")}>
                            {member.status}
                          </span>
                        </div>
                        <p className="truncate text-hs-caption text-hs-muted">{member.email ?? member.user_id}</p>
                        <p className="mt-1 text-[11px] text-hs-placeholder">
                          Last active {timeAgo(member.last_active_at)} · Invited by {member.invited_by_name ?? "System"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-[220px]">
                        <HsSelect
                          aria-label="Role"
                          value={member.role}
                          disabled={member.is_owner}
                          onChange={(e) => void changeRole(member, e.target.value as Role)}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>{labelForRole(role)}</option>
                          ))}
                        </HsSelect>
                      </div>
                      <HsSecondaryButton type="button" disabled={member.is_owner} onClick={() => void toggleSuspended(member)}>
                        {member.status === "suspended" ? "Reactivate" : "Suspend"}
                      </HsSecondaryButton>
                      <HsDangerButton type="button" disabled={member.is_owner} onClick={() => void remove(member)}>
                        Remove
                      </HsDangerButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
            <h2 className="text-hs-section font-semibold text-hs-text">Pending invitations</h2>
            <p className="mt-1 text-hs-caption text-hs-muted">Users listed here will join automatically after authentication.</p>
            <div className="mt-4 space-y-3">
              {invitations.length === 0 ? (
                <p className="rounded-hs border border-dashed border-hs-border bg-hs-page/60 px-4 py-6 text-center text-hs-caption text-hs-muted">
                  No pending invitations.
                </p>
              ) : (
                invitations.map((invite) => (
                  <div key={invite.id} className="rounded-hs border border-hs-border bg-hs-page/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-hs-text">{invite.full_name ?? invite.email}</p>
                        <p className="text-hs-caption text-hs-muted">{invite.email}</p>
                      </div>
                      <RoleBadge role={invite.role} />
                    </div>
                    <p className="mt-3 text-[11px] text-hs-placeholder">Expires {new Date(invite.expires_at).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
            <h2 className="text-hs-section font-semibold text-hs-text">Role change log</h2>
            <p className="mt-1 text-hs-caption text-hs-muted">Append-only trail for invite, role, suspension, and removal events.</p>
            <div className="mt-4 space-y-3">
              {changelog.length === 0 ? (
                <p className="rounded-hs border border-dashed border-hs-border bg-hs-page/60 px-4 py-6 text-center text-hs-caption text-hs-muted">
                  No role changes recorded.
                </p>
              ) : (
                changelog.map((row) => (
                  <div key={row.id} className="rounded-hs border border-hs-border bg-hs-page/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium capitalize text-hs-text">{row.action.replace(/_/g, " ")}</p>
                        <p className="mt-1 text-hs-caption text-hs-muted">{row.target_email ?? row.target_user_id ?? "Unknown member"}</p>
                      </div>
                      <span className="text-hs-caption text-hs-placeholder">{timeAgo(row.created_at)}</span>
                    </div>
                    <p className="mt-3 text-hs-caption text-hs-secondary">
                      {row.old_role ? labelForRole(row.old_role) : "None"} -&gt; {row.new_role ? labelForRole(row.new_role) : "None"}
                      {row.reason ? ` · ${row.reason}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
