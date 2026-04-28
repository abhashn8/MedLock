import { ROLE_DETAILS, isRole, type Role } from "@medlock/rbac";
import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";
import { requirePermission } from "./rbac.js";

type CampaignStatus = "PASS" | "FAIL" | "WARNING" | "PENDING";
type Decision = "approve" | "revoke" | "more_info" | "pending";

type CampaignRow = {
  id: string;
  organization_id: string;
  title: string;
  status: CampaignStatus;
  due_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  campaign_id: string;
  organization_id: string;
  user_id: string;
  system_name: string;
  manager_user_id: string | null;
  decision: CampaignStatus;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};

type MemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  is_owner: boolean;
  status: "active" | "suspended";
  full_name: string | null;
  email: string | null;
  department: string | null;
  notes: string | null;
  invited_by: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  last_active_at: string | null;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  department: string | null;
};

function toDecision(status: CampaignStatus): Decision {
  if (status === "PASS") return "approve";
  if (status === "FAIL") return "revoke";
  if (status === "WARNING") return "more_info";
  return "pending";
}

function toStatus(decision: unknown): CampaignStatus {
  if (decision === "approve") return "PASS";
  if (decision === "revoke") return "FAIL";
  if (decision === "more_info") return "WARNING";
  if (decision === "pending") return "PENDING";
  throw new HttpError(400, "invalid_decision", "Decision must be approve, revoke, more_info, or pending.");
}

async function getCurrentCampaign(context: AuthContext, organizationId: string): Promise<CampaignRow | null> {
  const { data, error } = await context.supabase
    .from("access_review_campaigns")
    .select("id, organization_id, title, status, due_at, created_by, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new HttpError(500, "access_review_campaign_query_failed", error.message);
  return (data ?? null) as CampaignRow | null;
}

async function listMembers(context: AuthContext, organizationId: string) {
  const { data, error } = await context.supabase
    .from("organization_memberships")
    .select(
      "id, organization_id, user_id, role, is_owner, status, full_name, email, department, notes, invited_by, invited_at, accepted_at, last_active_at, created_at",
    )
    .eq("organization_id", organizationId)
    .in("status", ["active", "suspended"])
    .order("created_at", { ascending: true });

  if (error) throw new HttpError(500, "access_review_members_query_failed", error.message);

  const rows = (data ?? []) as MemberRow[];
  const userIds = rows.map((row) => row.user_id);
  const profilesById = new Map<string, ProfileRow>();

  if (userIds.length > 0) {
    const profiles = await context.supabase
      .from("user_profiles")
      .select("user_id, full_name, department")
      .in("user_id", userIds);
    if (profiles.error) throw new HttpError(500, "access_review_profiles_query_failed", profiles.error.message);
    for (const profile of (profiles.data ?? []) as ProfileRow[]) {
      profilesById.set(profile.user_id, profile);
    }
  }

  return rows.map((row) => {
    const role = isRole(row.role) ? row.role : "auditor";
    const profile = profilesById.get(row.user_id);
    return {
      ...row,
      role,
      role_detail: ROLE_DETAILS[role],
      full_name: row.full_name ?? profile?.full_name ?? null,
      department: row.department ?? profile?.department ?? null,
    };
  });
}

async function listItems(context: AuthContext, organizationId: string, campaignId: string) {
  const { data, error } = await context.supabase
    .from("access_review_items")
    .select("id, campaign_id, organization_id, user_id, system_name, manager_user_id, decision, decision_note, decided_at, created_at")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw new HttpError(500, "access_review_items_query_failed", error.message);
  return (data ?? []) as ItemRow[];
}

function buildStats(items: ItemRow[], members: Array<{ status: string }>) {
  return {
    pending: items.filter((item) => item.decision === "PENDING").length,
    approved: items.filter((item) => item.decision === "PASS").length,
    revoke_requested: items.filter((item) => item.decision === "FAIL").length,
    more_info: items.filter((item) => item.decision === "WARNING").length,
    suspended_members: members.filter((member) => member.status === "suspended").length,
    total_members: members.length,
  };
}

export async function getAccessReviewOverview(context: AuthContext) {
  const actor = await requirePermission(context, "user_access_review", "read_only");
  const [campaign, members] = await Promise.all([
    getCurrentCampaign(context, actor.organization_id),
    listMembers(context, actor.organization_id),
  ]);

  const items = campaign ? await listItems(context, actor.organization_id, campaign.id) : [];
  const membersByUserId = new Map(members.map((member) => [member.user_id, member]));

  return {
    campaign,
    stats: buildStats(items, members),
    members,
    items: items.map((item) => {
      const member = membersByUserId.get(item.user_id);
      const manager = item.manager_user_id ? membersByUserId.get(item.manager_user_id) : undefined;
      return {
        ...item,
        decision_key: toDecision(item.decision),
        user: member ?? null,
        manager: manager ?? null,
      };
    }),
    permission: {
      can_write: actor.role === "admin" || actor.role === "security_officer" || actor.role === "compliance_manager",
    },
  };
}

export async function createAccessReviewCampaign(context: AuthContext, body: Record<string, unknown>) {
  const actor = await requirePermission(context, "user_access_review", "full");
  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim()
    : "Quarterly Access Certification";
  const dueAt = typeof body.due_at === "string" && body.due_at.trim()
    ? body.due_at
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const members = await listMembers(context, actor.organization_id);

  const { data: campaign, error } = await context.supabase
    .from("access_review_campaigns")
    .insert({
      organization_id: actor.organization_id,
      title,
      status: "PENDING",
      due_at: dueAt,
      created_by: context.user.id,
    })
    .select("id, organization_id, title, status, due_at, created_by, created_at, updated_at")
    .single();

  if (error || !campaign) {
    throw new HttpError(500, "access_review_campaign_create_failed", error?.message);
  }

  if (members.length > 0) {
    const { error: itemError } = await context.supabase.from("access_review_items").insert(
      members.map((member) => ({
        campaign_id: campaign.id,
        organization_id: actor.organization_id,
        user_id: member.user_id,
        system_name: `MedLock RBAC - ${ROLE_DETAILS[member.role as Role].label}`,
        manager_user_id: context.user.id,
        decision: "PENDING",
      })),
    );

    if (itemError) {
      throw new HttpError(500, "access_review_items_create_failed", itemError.message);
    }
  }

  return getAccessReviewOverview(context);
}

export async function updateAccessReviewItem(
  context: AuthContext,
  itemId: string,
  body: Record<string, unknown>,
) {
  const actor = await requirePermission(context, "user_access_review", "full");
  const decision = toStatus(body.decision);
  const note = typeof body.note === "string" ? body.note.trim() || null : null;

  const { data, error } = await context.supabase
    .from("access_review_items")
    .update({
      decision,
      decision_note: note,
      manager_user_id: context.user.id,
      decided_at: decision === "PENDING" ? null : new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", actor.organization_id)
    .select("id")
    .single();

  if (error || !data) {
    throw new HttpError(500, "access_review_item_update_failed", error?.message);
  }

  return getAccessReviewOverview(context);
}
