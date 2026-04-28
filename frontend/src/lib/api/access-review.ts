import { apiFetch } from "@/lib/api/client";
import type { Role } from "@/lib/rbac/permissions";
import type { RoleMember } from "@/lib/api/roles";

export type AccessReviewDecision = "approve" | "revoke" | "more_info" | "pending";

export type AccessReviewCampaign = {
  id: string;
  organization_id: string;
  title: string;
  status: "PASS" | "FAIL" | "WARNING" | "PENDING";
  due_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AccessReviewMember = RoleMember & {
  role_detail?: {
    label: string;
    color: string;
    description: string;
  };
};

export type AccessReviewItem = {
  id: string;
  campaign_id: string;
  organization_id: string;
  user_id: string;
  system_name: string;
  manager_user_id: string | null;
  decision: "PASS" | "FAIL" | "WARNING" | "PENDING";
  decision_key: AccessReviewDecision;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  user: AccessReviewMember | null;
  manager: AccessReviewMember | null;
};

export type AccessReviewOverview = {
  campaign: AccessReviewCampaign | null;
  stats: {
    pending: number;
    approved: number;
    revoke_requested: number;
    more_info: number;
    suspended_members: number;
    total_members: number;
  };
  members: AccessReviewMember[];
  items: AccessReviewItem[];
  permission: {
    can_write: boolean;
  };
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed");
  }
  return data as T;
}

export async function getAccessReviewOverview() {
  return readJson<AccessReviewOverview>(await apiFetch("/api/access-review/overview"));
}

export async function createAccessReviewCampaign(input: {
  title?: string;
  due_at?: string;
}) {
  return readJson<AccessReviewOverview>(
    await apiFetch("/api/access-review/campaigns", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function updateAccessReviewDecision(
  itemId: string,
  input: {
    decision: AccessReviewDecision;
    note?: string;
  },
) {
  return readJson<AccessReviewOverview>(
    await apiFetch(`/api/access-review/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export function roleLabel(role: Role) {
  return role
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
