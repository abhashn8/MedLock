"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createAccessReviewCampaign,
  getAccessReviewOverview,
  updateAccessReviewDecision,
  type AccessReviewDecision,
  type AccessReviewItem,
  type AccessReviewMember,
  type AccessReviewOverview,
} from "@/lib/api/access-review";
import { patchRoleMember } from "@/lib/api/roles";
import {
  canAccess,
  PAGE_LABELS,
  ROLE_DETAILS,
  ROUTE_TO_PAGE,
  type NavPage,
  type Role,
} from "@/lib/rbac/permissions";
import { useDashboardRbac } from "@/lib/rbac/context";
import { HsAlertBanner } from "@/components/hipaa-shield/HsAlertBanner";
import { HsDangerButton } from "@/components/hipaa-shield/HsDangerButton";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";
import { HsModal } from "@/components/hipaa-shield/HsModal";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsSkeleton } from "@/components/hipaa-shield/HsSkeleton";
import { HsTextarea } from "@/components/hipaa-shield/HsTextarea";
import { cn } from "@/lib/utils";

const roleStyles: Record<Role, string> = {
  admin: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  privacy_officer: "border-teal-500/30 bg-teal-500/10 text-teal-300",
  security_officer: "border-red-500/30 bg-red-500/10 text-red-300",
  compliance_manager: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  auditor: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  data_analyst: "border-slate-700 bg-slate-800/40 text-slate-300",
  developer: "border-pink-500/30 bg-pink-500/10 text-pink-300",
};

const decisionStyles: Record<AccessReviewDecision, string> = {
  approve: "border-hs-success-border bg-hs-success-bg text-hs-success",
  revoke: "border-hs-danger-border bg-hs-danger-bg text-hs-danger",
  more_info: "border-hs-warning-border bg-hs-warning-bg text-hs-warning",
  pending: "border-hs-border bg-hs-fill text-hs-muted",
};

function friendlyError(message: string) {
  if (message === "Failed to fetch" || message.includes("fetch")) {
    return "Access review data is unavailable because the backend API is not reachable. Start the backend on port 4000 and refresh.";
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

function initials(member: Pick<AccessReviewMember, "full_name" | "email"> | null | undefined) {
  const source = member?.full_name?.trim() || member?.email?.split("@")[0] || "?";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={cn("inline-flex rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium", roleStyles[role])}>
      {ROLE_DETAILS[role].label}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: AccessReviewDecision }) {
  const label =
    decision === "approve"
      ? "Approved"
      : decision === "revoke"
        ? "Revoke"
        : decision === "more_info"
          ? "More info"
          : "Pending";
  return (
    <span className={cn("inline-flex rounded-hs-pill border px-2.5 py-1 text-hs-caption font-medium", decisionStyles[decision])}>
      {label}
    </span>
  );
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

function memberName(member: AccessReviewMember | null | undefined) {
  return member?.full_name ?? member?.email ?? "Unknown user";
}

function accessPages(role: Role): NavPage[] {
  return Object.values(ROUTE_TO_PAGE).filter((page, index, all) => all.indexOf(page) === index && canAccess(role, page));
}

function EmptyCampaign({
  canWriteAccess,
  onStart,
  starting,
}: {
  canWriteAccess: boolean;
  onStart: () => void;
  starting: boolean;
}) {
  return (
    <div className="rounded-hs-card border border-dashed border-hs-border bg-hs-card">
      <HsEmptyState
        title="No access review campaign"
        description="Start a campaign to snapshot current roles and collect access certification decisions."
        actionLabel={canWriteAccess ? "Start campaign" : undefined}
        onAction={canWriteAccess ? onStart : undefined}
      />
      {starting ? <p className="pb-6 text-center text-hs-caption text-hs-muted">Starting campaign...</p> : null}
    </div>
  );
}

export default function UserAccessReviewPage() {
  const rbac = useDashboardRbac();
  const canWriteAccess = rbac.canWritePage("user_access_review");
  const [overview, setOverview] = useState<AccessReviewOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<AccessReviewItem | null>(null);
  const [selectedMember, setSelectedMember] = useState<AccessReviewMember | null>(null);
  const [decision, setDecision] = useState<AccessReviewDecision>("approve");
  const [note, setNote] = useState("");
  const [rolePatch, setRolePatch] = useState<Role>("auditor");

  async function load() {
    setError(null);
    try {
      setOverview(await getAccessReviewOverview());
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Failed to load access review."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const campaign = overview?.campaign ?? null;
  const stats = overview?.stats;
  const members = useMemo(() => overview?.members ?? [], [overview?.members]);
  const items = useMemo(() => overview?.items ?? [], [overview?.items]);

  const roleCounts = useMemo(() => {
    const counts = new Map<Role, number>();
    for (const member of members) {
      counts.set(member.role, (counts.get(member.role) ?? 0) + 1);
    }
    return counts;
  }, [members]);

  function openReview(item: AccessReviewItem) {
    setSelectedItem(item);
    setSelectedMember(item.user);
    setDecision(item.decision_key);
    setNote(item.decision_note ?? "");
    setRolePatch(item.user?.role ?? "auditor");
  }

  function openMember(member: AccessReviewMember) {
    setSelectedItem(items.find((item) => item.user_id === member.user_id) ?? null);
    setSelectedMember(member);
    setDecision("approve");
    setNote("");
    setRolePatch(member.role);
  }

  async function startCampaign() {
    setSaving(true);
    setError(null);
    try {
      const due = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      setOverview(await createAccessReviewCampaign({ title: "Quarterly Access Certification", due_at: due }));
      setSuccess("Access review campaign started.");
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Could not start campaign."));
    } finally {
      setSaving(false);
    }
  }

  async function saveDecision() {
    if (!selectedItem) return;
    setSaving(true);
    setError(null);
    try {
      setOverview(await updateAccessReviewDecision(selectedItem.id, { decision, note }));
      setSuccess("Review decision saved.");
      setSelectedItem(null);
      setSelectedMember(null);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Could not save decision."));
    } finally {
      setSaving(false);
    }
  }

  async function saveRoleChange() {
    if (!selectedMember) return;
    setSaving(true);
    setError(null);
    try {
      await patchRoleMember(selectedMember.id, { role: rolePatch, reason: "Access review role adjustment" });
      await load();
      setSuccess("Access role updated.");
      setSelectedItem(null);
      setSelectedMember(null);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Could not update access."));
    } finally {
      setSaving(false);
    }
  }

  async function suspendMember() {
    if (!selectedMember) return;
    setSaving(true);
    setError(null);
    try {
      await patchRoleMember(selectedMember.id, {
        status: selectedMember.status === "suspended" ? "active" : "suspended",
        reason: "Access review status adjustment",
      });
      await load();
      setSuccess(selectedMember.status === "suspended" ? "User reactivated." : "User suspended.");
      setSelectedItem(null);
      setSelectedMember(null);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Could not update status."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-hs-page px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <section className="overflow-hidden rounded-hs-card border border-hs-border bg-hs-card">
          <div className="bg-gradient-to-br from-hs-info-bg via-hs-card to-hs-card p-6 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-hs-caption font-semibold uppercase tracking-[0.1em] text-hs-primary">Access & Identity</p>
                <h1 className="mt-3 text-hs-title font-semibold text-hs-text">User Access Review</h1>
                <p className="mt-3 text-hs-body text-hs-muted">
                  Certify that every active member still needs their current MedLock role. Record approve, revoke, or more-info decisions without creating ad hoc permission overrides.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <HsSecondaryButton type="button" onClick={() => void load()}>
                  Refresh
                </HsSecondaryButton>
                {canWriteAccess && !campaign ? (
                  <HsPrimaryButton type="button" loading={saving} onClick={() => void startCampaign()}>
                    Start campaign
                  </HsPrimaryButton>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <HsAlertBanner variant="WARNING" onDismiss={() => setError(null)}>
            <span className="font-medium">Access review issue:</span> {error}
          </HsAlertBanner>
        ) : null}
        {success ? (
          <HsAlertBanner variant="INFO" onDismiss={() => setSuccess(null)}>
            <span className="font-medium">Saved:</span> {success}
          </HsAlertBanner>
        ) : null}
        {rbac.permissionFor("user_access_review") === "read_only" ? (
          <HsAlertBanner variant="INFO">
            You have read-only access. Decisions and role changes are disabled.
          </HsAlertBanner>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending reviews" value={loading ? "..." : String(stats?.pending ?? 0)} context="Awaiting certification" />
          <StatCard label="Approved" value={loading ? "..." : String(stats?.approved ?? 0)} context="Access certified" />
          <StatCard label="Revocations" value={loading ? "..." : String(stats?.revoke_requested ?? 0)} context="Access removal requested" />
          <StatCard label="Members in scope" value={loading ? "..." : String(stats?.total_members ?? 0)} context={`${stats?.suspended_members ?? 0} suspended`} />
        </section>

        {!loading && !campaign ? (
          <EmptyCampaign canWriteAccess={canWriteAccess} onStart={() => void startCampaign()} starting={saving} />
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-hs-section font-semibold text-hs-text">Current role inventory</h2>
                <p className="mt-1 text-hs-caption text-hs-muted">Roles fetched from organization memberships.</p>
              </div>
              {campaign ? (
                <span className="rounded-hs-pill bg-hs-fill px-3 py-1 text-hs-caption text-hs-muted">
                  {campaign.title}
                </span>
              ) : null}
            </div>
            <div className="mt-5 grid gap-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <HsSkeleton key={i} className="h-20 w-full" />)
              ) : members.length === 0 ? (
                <p className="rounded-hs border border-dashed border-hs-border bg-hs-page/60 px-4 py-6 text-center text-hs-caption text-hs-muted">
                  No members loaded.
                </p>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="rounded-hs border border-hs-border bg-hs-page/60 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-hs-info-bg text-hs-caption font-semibold text-hs-primary">
                          {initials(member)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-hs-text">{memberName(member)}</p>
                          <p className="truncate text-hs-caption text-hs-muted">{member.email ?? member.user_id}</p>
                          <p className="mt-1 text-[11px] text-hs-placeholder">Last active {timeAgo(member.last_active_at)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <RoleBadge role={member.role} />
                        <span className={cn("rounded-hs-pill px-2.5 py-1 text-hs-caption font-medium", member.status === "active" ? "bg-hs-success-bg text-hs-success" : "bg-hs-danger-bg text-hs-danger")}>
                          {member.status}
                        </span>
                        <HsSecondaryButton type="button" disabled={!canWriteAccess} onClick={() => openMember(member)}>
                          Edit access
                        </HsSecondaryButton>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-hs-card border border-hs-border bg-hs-card p-6">
            <div>
              <h2 className="text-hs-section font-semibold text-hs-text">Review queue</h2>
              <p className="mt-1 text-hs-caption text-hs-muted">Approve, request more info, or flag access for revocation.</p>
            </div>
            <div className="mt-5 space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <HsSkeleton key={i} className="h-24 w-full" />)
              ) : items.length === 0 ? (
                <p className="rounded-hs border border-dashed border-hs-border bg-hs-page/60 px-4 py-6 text-center text-hs-caption text-hs-muted">
                  No review items yet. Start a campaign to generate items from current members.
                </p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-hs border border-hs-border bg-hs-page/60 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-hs-text">{memberName(item.user)}</p>
                          {item.user ? <RoleBadge role={item.user.role} /> : null}
                          <DecisionBadge decision={item.decision_key} />
                        </div>
                        <p className="mt-1 text-hs-caption text-hs-muted">{item.system_name}</p>
                        <p className="mt-1 text-[11px] text-hs-placeholder">
                          Manager: {memberName(item.manager)} · Decided {timeAgo(item.decided_at)}
                        </p>
                        {item.decision_note ? <p className="mt-2 text-hs-caption text-hs-secondary">{item.decision_note}</p> : null}
                      </div>
                      <HsPrimaryButton type="button" disabled={!canWriteAccess} onClick={() => openReview(item)}>
                        Review access
                      </HsPrimaryButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-hs-card border border-hs-border bg-hs-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-hs-section font-semibold text-hs-text">Role coverage</h2>
              <p className="mt-1 text-hs-caption text-hs-muted">
                Current member distribution across fixed RBAC roles and the access each role unlocks.
              </p>
            </div>
            <span className="w-fit rounded-hs-pill border border-hs-border bg-hs-page px-3 py-1 text-hs-caption font-medium text-hs-muted">
              {members.length} members in scope
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {(Object.keys(ROLE_DETAILS) as Role[]).map((role) => {
              const pages = accessPages(role);
              const count = roleCounts.get(role) ?? 0;
              const previewPages = pages.slice(0, 5);
              return (
                <div
                  key={role}
                  className="group overflow-hidden rounded-hs-card border border-hs-border bg-hs-page/60 shadow-sm hs-transition-border hover:border-hs-border-strong"
                >
                  <div className="flex min-h-[148px] flex-col justify-between p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <RoleBadge role={role} />
                        <p className="mt-3 text-hs-caption leading-relaxed text-hs-secondary">
                          {ROLE_DETAILS[role].description}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={cn("inline-flex size-12 items-center justify-center rounded-hs-card border text-xl font-semibold tabular-nums", roleStyles[role])}>
                          {count}
                        </div>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-hs-placeholder">
                          member{count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-hs-border pt-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-hs-muted">
                          Accessible pages
                        </p>
                        <span className="rounded-hs-pill bg-hs-card px-2 py-0.5 text-[11px] font-medium text-hs-muted">
                          {pages.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {previewPages.map((page) => (
                          <span
                            key={page}
                            className="rounded-hs-pill border border-hs-border bg-hs-card px-2.5 py-1 text-[11px] font-medium text-hs-text"
                          >
                            {PAGE_LABELS[page]}
                          </span>
                        ))}
                        {pages.length > previewPages.length ? (
                          <span className="rounded-hs-pill border border-dashed border-hs-border bg-hs-card px-2.5 py-1 text-[11px] font-medium text-hs-muted">
                            +{pages.length - previewPages.length} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <HsModal
        open={Boolean(selectedMember)}
        onClose={() => {
          if (saving) return;
          setSelectedItem(null);
          setSelectedMember(null);
        }}
        title="Edit access review"
        className="max-w-[720px]"
        footer={
          <>
            <HsSecondaryButton
              type="button"
              disabled={saving}
              onClick={() => {
                setSelectedItem(null);
                setSelectedMember(null);
              }}
            >
              Cancel
            </HsSecondaryButton>
            {selectedItem ? (
              <HsPrimaryButton type="button" loading={saving} disabled={!canWriteAccess} onClick={() => void saveDecision()}>
                Save decision
              </HsPrimaryButton>
            ) : null}
          </>
        }
      >
        {selectedMember ? (
          <div className="space-y-6">
            <div className="rounded-hs border border-hs-border bg-hs-page/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-hs-text">{memberName(selectedMember)}</p>
                  <p className="text-hs-caption text-hs-muted">{selectedMember.email ?? selectedMember.user_id}</p>
                </div>
                <RoleBadge role={selectedMember.role} />
              </div>
            </div>

            {selectedItem ? (
              <div className="space-y-3">
                <h3 className="text-hs-section font-semibold text-hs-text">Review decision</h3>
                <HsSelect label="Decision" value={decision} disabled={!canWriteAccess} onChange={(e) => setDecision(e.target.value as AccessReviewDecision)}>
                  <option value="approve">Approve current access</option>
                  <option value="more_info">Request more info</option>
                  <option value="revoke">Recommend revocation</option>
                  <option value="pending">Return to pending</option>
                </HsSelect>
                <HsTextarea label="Decision note" value={note} disabled={!canWriteAccess} onChange={(e) => setNote(e.target.value)} />
              </div>
            ) : null}

            <div className="space-y-3 border-t border-hs-border pt-5">
              <h3 className="text-hs-section font-semibold text-hs-text">Access action</h3>
              <p className="text-hs-caption text-hs-muted">
                Access changes use the fixed RBAC role/status model. No custom per-user page overrides are created.
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <HsSelect label="Fixed role" value={rolePatch} disabled={!canWriteAccess || selectedMember.is_owner} onChange={(e) => setRolePatch(e.target.value as Role)}>
                  {(Object.keys(ROLE_DETAILS) as Role[]).map((role) => (
                    <option key={role} value={role}>{ROLE_DETAILS[role].label}</option>
                  ))}
                </HsSelect>
                <HsPrimaryButton type="button" loading={saving} disabled={!canWriteAccess || selectedMember.is_owner || rolePatch === selectedMember.role} onClick={() => void saveRoleChange()}>
                  Save role
                </HsPrimaryButton>
                <HsDangerButton type="button" loading={saving} disabled={!canWriteAccess || selectedMember.is_owner} onClick={() => void suspendMember()}>
                  {selectedMember.status === "suspended" ? "Reactivate" : "Suspend"}
                </HsDangerButton>
              </div>
            </div>

            <div className="rounded-hs border border-hs-border bg-hs-page/60 p-4">
              <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-muted">Current access surface</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {accessPages(selectedMember.role).slice(0, 16).map((page) => (
                  <span key={page} className="rounded-hs-pill bg-hs-card px-2 py-1 text-[11px] text-hs-text">
                    {PAGE_LABELS[page]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </HsModal>
    </div>
  );
}
