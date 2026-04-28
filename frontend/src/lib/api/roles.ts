import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/rbac/permissions";

export type RoleMember = {
  id: string;
  user_id: string;
  role: Role;
  is_owner: boolean;
  status: "active" | "suspended";
  last_active_at: string | null;
  invited_by_name: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  notes: string | null;
  full_name: string | null;
  email: string | null;
  department: string | null;
  created_at: string;
};

export type RoleInvitation = {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  invited_by: string | null;
  expires_at: string;
  status: "pending";
  notes: string | null;
  created_at: string;
};

export type RoleChangeLogRow = {
  id: string;
  changed_by: string | null;
  target_user_id: string | null;
  target_email: string | null;
  action: string;
  old_role: Role | null;
  new_role: Role | null;
  reason: string | null;
  created_at: string;
};

export type CurrentRoleResponse = {
  membership_id: string;
  organization_id: string;
  role: Role;
  is_owner: boolean;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed");
  }
  return data as T;
}

export async function acceptRoleInvites() {
  return readJson<{ accepted: Array<{ organization_id: string; membership_id: string }> }>(
    await apiFetch("/api/roles/accept-invite", { method: "POST" }),
  );
}

export async function getCurrentRole() {
  return readJson<CurrentRoleResponse>(await apiFetch("/api/roles/me"));
}

export async function getRoleMembers() {
  return readJson<RoleMember[]>(await apiFetch("/api/roles/members"));
}

export async function getRoleInvitations() {
  return readJson<RoleInvitation[]>(await apiFetch("/api/roles/invitations"));
}

export async function getRoleChangelog(page = 1, limit = 20) {
  return readJson<{
    rows: RoleChangeLogRow[];
    page: number;
    limit: number;
    total: number;
    roles_defined: number;
  }>(await apiFetch(`/api/roles/changelog?page=${page}&limit=${limit}`));
}

export async function inviteRoleMember(input: {
  full_name?: string;
  email: string;
  role: Role;
  notes?: string;
}) {
  return readJson<{ status: "invited"; invitation_id: string }>(
    await apiFetch("/api/roles/invite", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function patchRoleMember(
  membershipId: string,
  input: { role?: Role; status?: "active" | "suspended"; notes?: string; reason?: string },
) {
  return readJson<RoleMember>(
    await apiFetch(`/api/roles/members/${membershipId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteRoleMember(membershipId: string) {
  const response = await apiFetch(`/api/roles/members/${membershipId}`, { method: "DELETE" });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message ?? "Request failed");
  }
}
