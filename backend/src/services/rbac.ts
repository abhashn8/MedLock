import {
  can,
  isRole,
  permissionMeets,
  type NavPage,
  type Permission,
  type Role,
} from "@medlock/rbac";
import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";

export type CurrentMembership = {
  id: string;
  organization_id: string;
  role: Role;
  is_owner: boolean;
  status: "active";
  full_name: string | null;
  email: string | null;
};

export async function acceptPendingInvitationsForCurrentUser(
  context: AuthContext,
): Promise<Array<{ organization_id: string; membership_id: string }>> {
  const { data, error } = await context.supabase.rpc(
    "accept_pending_organization_invitations",
  );

  if (error) {
    const message = String(error.message ?? "");
    // If DB migrations are behind (or schema cache is stale), don't block role resolution.
    if (error.code === "PGRST202" && message.includes("accept_pending_organization_invitations")) {
      return [];
    }
    throw new HttpError(500, "invite_accept_failed", error.message);
  }

  return (data ?? []) as Array<{ organization_id: string; membership_id: string }>;
}

async function bootstrapOrganization(context: AuthContext): Promise<void> {
  const orgName = `MedLock - ${context.user.email ?? context.user.id}`;
  const { error } = await context.supabase.rpc("bootstrap_organization_for_current_user", {
    org_name: orgName,
  });

  if (error) {
    throw new HttpError(500, "organization_bootstrap_failed", error.message);
  }
}

export async function getCurrentMembership(
  context: AuthContext,
  options: { bootstrap?: boolean } = {},
): Promise<CurrentMembership> {
  await acceptPendingInvitationsForCurrentUser(context);

  let { data, error } = await context.supabase
    .from("organization_memberships")
    .select("id, organization_id, role, is_owner, status, full_name, email")
    .eq("user_id", context.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "organization_lookup_failed", error.message);
  }

  if (!data && options.bootstrap !== false) {
    await bootstrapOrganization(context);
    const retry = await context.supabase
      .from("organization_memberships")
      .select("id, organization_id, role, is_owner, status, full_name, email")
      .eq("user_id", context.user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new HttpError(500, "organization_lookup_failed", error.message);
  }

  if (!data) {
    throw new HttpError(404, "organization_not_found", "No active organization membership found.");
  }

  if (!isRole(data.role)) {
    throw new HttpError(403, "invalid_role", "Current membership has an unsupported role.");
  }

  const email = context.user.email ?? null;
  if (email && data.email !== email) {
    await context.supabase
      .from("organization_memberships")
      .update({ email, last_active_at: new Date().toISOString() })
      .eq("id", data.id);
  } else {
    await context.supabase
      .from("organization_memberships")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", data.id);
  }

  return data as CurrentMembership;
}

export async function getOrganizationId(context: AuthContext): Promise<string> {
  const membership = await getCurrentMembership(context);
  return membership.organization_id;
}

export async function getCurrentUserRole(context: AuthContext): Promise<Role> {
  const membership = await getCurrentMembership(context);
  return membership.role;
}

export async function requirePermission(
  context: AuthContext,
  page: NavPage,
  required: Permission = "full",
): Promise<CurrentMembership> {
  const membership = await getCurrentMembership(context);
  const permission = can(membership.role, page);

  if (!permissionMeets(permission, required)) {
    throw new HttpError(403, "forbidden", `Requires ${required} access to ${page}.`);
  }

  return membership;
}
