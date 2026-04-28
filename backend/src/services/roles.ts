import { ROLE_DETAILS, ROLES, isRole, type Role } from "@medlock/rbac";
import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";
import {
  acceptPendingInvitationsForCurrentUser,
  getCurrentMembership,
  requirePermission,
  type CurrentMembership,
} from "./rbac.js";

type MembershipStatus = "active" | "suspended" | "removed";

type MemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: Role;
  is_owner: boolean;
  status: MembershipStatus;
  last_active_at: string | null;
  invited_by: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  notes: string | null;
  full_name: string | null;
  email: string | null;
  department: string | null;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  department: string | null;
};

function normalizeEmail(email: unknown): string {
  if (typeof email !== "string" || !email.trim()) {
    throw new HttpError(400, "invalid_request", "email is required");
  }
  return email.trim().toLowerCase();
}

function normalizeRole(role: unknown): Role {
  if (!isRole(role)) {
    throw new HttpError(400, "invalid_role", "Unsupported role.");
  }
  return role;
}

async function insertRoleLog(
  context: AuthContext,
  input: {
    organization_id: string;
    target_user_id?: string | null;
    target_email?: string | null;
    action: "invited" | "role_changed" | "suspended" | "reactivated" | "removed";
    old_role?: Role | null;
    new_role?: Role | null;
    reason?: string | null;
  },
) {
  const { error } = await context.supabase.from("role_change_log").insert({
    organization_id: input.organization_id,
    changed_by: context.user.id,
    target_user_id: input.target_user_id ?? null,
    target_email: input.target_email ?? null,
    action: input.action,
    old_role: input.old_role ?? null,
    new_role: input.new_role ?? null,
    reason: input.reason ?? null,
  });

  if (error) {
    throw new HttpError(500, "role_log_insert_failed", error.message);
  }
}

async function loadMembershipById(
  context: AuthContext,
  organizationId: string,
  membershipId: string,
): Promise<MemberRow> {
  const { data, error } = await context.supabase
    .from("organization_memberships")
    .select(
      "id, organization_id, user_id, role, is_owner, status, last_active_at, invited_by, invited_at, accepted_at, notes, full_name, email, department, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", membershipId)
    .maybeSingle();

  if (error) throw new HttpError(500, "member_lookup_failed", error.message);
  if (!data) throw new HttpError(404, "member_not_found", "Membership not found.");
  if (!isRole(data.role)) throw new HttpError(500, "invalid_member_role", "Membership has invalid role.");
  return data as MemberRow;
}

async function assertCanManageTarget(
  actor: CurrentMembership,
  target: MemberRow,
  action: "update" | "remove",
) {
  if (target.is_owner) {
    throw new HttpError(400, `cannot_${action}_owner`, "The organization owner cannot be changed here.");
  }
  if (target.role === "admin" && !actor.is_owner) {
    throw new HttpError(403, "owner_required", "Only the organization owner can manage another admin.");
  }
}

export async function getMyRole(context: AuthContext) {
  const membership = await getCurrentMembership(context);
  return {
    membership_id: membership.id,
    organization_id: membership.organization_id,
    role: membership.role,
    is_owner: membership.is_owner,
    role_detail: ROLE_DETAILS[membership.role],
  };
}

export async function acceptInvites(context: AuthContext) {
  const accepted = await acceptPendingInvitationsForCurrentUser(context);
  return { accepted };
}

export async function inviteMember(context: AuthContext, body: Record<string, unknown>) {
  const actor = await requirePermission(context, "role_management", "full");
  const email = normalizeEmail(body.email);
  const role = normalizeRole(body.role);
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  const existing = await context.supabase
    .from("organization_memberships")
    .select("id, status")
    .eq("organization_id", actor.organization_id)
    .eq("email", email)
    .in("status", ["active", "suspended"])
    .maybeSingle();

  if (existing.error) {
    throw new HttpError(500, "member_lookup_failed", existing.error.message);
  }
  if (existing.data) {
    throw new HttpError(409, "member_already_exists", "That email is already a member.");
  }

  const pending = await context.supabase
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", actor.organization_id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (pending.error) {
    throw new HttpError(500, "invitation_lookup_failed", pending.error.message);
  }

  const payload = {
    organization_id: actor.organization_id,
    full_name: fullName,
    email,
    role,
    invited_by: context.user.id,
    notes,
    status: "pending",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const result = pending.data
    ? await context.supabase
        .from("organization_invitations")
        .update({ ...payload, resent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", pending.data.id)
        .select("id")
        .single()
    : await context.supabase
        .from("organization_invitations")
        .insert(payload)
        .select("id")
        .single();

  if (result.error || !result.data) {
    throw new HttpError(500, "invitation_create_failed", result.error?.message);
  }

  await insertRoleLog(context, {
    organization_id: actor.organization_id,
    target_email: email,
    action: "invited",
    new_role: role,
    reason: notes,
  });

  return { status: "invited", invitation_id: result.data.id };
}

export async function listMembers(context: AuthContext) {
  const actor = await requirePermission(context, "role_management", "full");
  const { data, error } = await context.supabase
    .from("organization_memberships")
    .select(
      "id, organization_id, user_id, role, is_owner, status, last_active_at, invited_by, invited_at, accepted_at, notes, full_name, email, department, created_at",
    )
    .eq("organization_id", actor.organization_id)
    .in("status", ["active", "suspended"])
    .order("created_at", { ascending: true });

  if (error) throw new HttpError(500, "members_query_failed", error.message);

  const members = (data ?? []) as MemberRow[];
  const userIds = [...new Set(members.flatMap((m) => [m.user_id, m.invited_by]).filter(Boolean))];
  const profilesById = new Map<string, ProfileRow>();

  if (userIds.length > 0) {
    const profiles = await context.supabase
      .from("user_profiles")
      .select("user_id, full_name, department")
      .in("user_id", userIds);
    if (profiles.error) throw new HttpError(500, "profiles_query_failed", profiles.error.message);
    for (const profile of (profiles.data ?? []) as ProfileRow[]) {
      profilesById.set(profile.user_id, profile);
    }
  }

  return members.map((member) => {
    const profile = profilesById.get(member.user_id);
    const inviter = member.invited_by ? profilesById.get(member.invited_by) : undefined;
    return {
      ...member,
      full_name: member.full_name ?? profile?.full_name ?? null,
      department: member.department ?? profile?.department ?? null,
      invited_by_name: inviter?.full_name ?? null,
      role_detail: ROLE_DETAILS[member.role],
    };
  });
}

export async function listInvitations(context: AuthContext) {
  const actor = await requirePermission(context, "role_management", "full");
  const { data, error } = await context.supabase
    .from("organization_invitations")
    .select("id, full_name, email, role, invited_by, expires_at, accepted_at, resent_at, status, notes, created_at")
    .eq("organization_id", actor.organization_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new HttpError(500, "invitations_query_failed", error.message);
  return (data ?? []).map((invitation) => ({
    ...invitation,
    role_detail: ROLE_DETAILS[normalizeRole(invitation.role)],
  }));
}

export async function updateMember(
  context: AuthContext,
  membershipId: string,
  body: Record<string, unknown>,
) {
  const actor = await requirePermission(context, "role_management", "full");
  const target = await loadMembershipById(context, actor.organization_id, membershipId);

  if (target.user_id === context.user.id) {
    throw new HttpError(400, "cannot_update_self", "You cannot change your own role or status.");
  }
  await assertCanManageTarget(actor, target, "update");

  const patch: Record<string, unknown> = {};
  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
  let action: "role_changed" | "suspended" | "reactivated" | null = null;
  let newRole: Role | null = null;

  if (body.role !== undefined) {
    newRole = normalizeRole(body.role);
    patch.role = newRole;
    if (newRole !== target.role) action = "role_changed";
  }

  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "suspended") {
      throw new HttpError(400, "invalid_status", "Status must be active or suspended.");
    }
    patch.status = body.status;
    if (body.status === "suspended" && target.status !== "suspended") action = "suspended";
    if (body.status === "active" && target.status === "suspended") action = "reactivated";
  }

  if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;

  if (Object.keys(patch).length === 0) {
    return target;
  }

  const { data, error } = await context.supabase
    .from("organization_memberships")
    .update(patch)
    .eq("id", membershipId)
    .eq("organization_id", actor.organization_id)
    .select(
      "id, organization_id, user_id, role, is_owner, status, last_active_at, invited_by, invited_at, accepted_at, notes, full_name, email, department, created_at",
    )
    .single();

  if (error || !data) throw new HttpError(500, "member_update_failed", error?.message);

  if (action) {
    await insertRoleLog(context, {
      organization_id: actor.organization_id,
      target_user_id: target.user_id,
      target_email: target.email,
      action,
      old_role: target.role,
      new_role: newRole ?? target.role,
      reason,
    });
  }

  return data;
}

export async function removeMember(context: AuthContext, membershipId: string) {
  const actor = await requirePermission(context, "role_management", "full");
  const target = await loadMembershipById(context, actor.organization_id, membershipId);

  if (target.user_id === context.user.id) {
    throw new HttpError(400, "cannot_remove_self", "You cannot remove your own membership.");
  }
  await assertCanManageTarget(actor, target, "remove");

  const { error } = await context.supabase
    .from("organization_memberships")
    .update({ status: "removed" })
    .eq("id", membershipId)
    .eq("organization_id", actor.organization_id);

  if (error) throw new HttpError(500, "member_remove_failed", error.message);

  await insertRoleLog(context, {
    organization_id: actor.organization_id,
    target_user_id: target.user_id,
    target_email: target.email,
    action: "removed",
    old_role: target.role,
    reason: "Membership removed",
  });
}

export async function listChangelog(context: AuthContext, page = 1, limit = 20) {
  const actor = await requirePermission(context, "role_management", "full");
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  const { data, error, count } = await context.supabase
    .from("role_change_log")
    .select("id, changed_by, target_user_id, target_email, action, old_role, new_role, reason, created_at", {
      count: "exact",
    })
    .eq("organization_id", actor.organization_id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new HttpError(500, "changelog_query_failed", error.message);

  return {
    rows: data ?? [],
    page: safePage,
    limit: safeLimit,
    total: count ?? 0,
    roles_defined: ROLES.length,
  };
}
