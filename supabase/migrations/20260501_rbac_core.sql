-- Fixed MedLock RBAC model: 7 roles, email-based pending invites, and audit log.

create extension if not exists pgcrypto;

-- Policies that mention organization_memberships.role must be removed before
-- converting that column from the legacy enum to text.
drop policy if exists scan_schedules_org_write on scan_schedules;
drop policy if exists phi_inventory_assets_org_write on phi_inventory_assets;
drop policy if exists deidentification_checks_org_write on deidentification_checks;
drop policy if exists access_policies_org_write on access_policies;
drop policy if exists app_roles_org_select on app_roles;
drop policy if exists app_roles_org_write on app_roles;
drop policy if exists user_role_assignments_org_select on user_role_assignments;
drop policy if exists user_role_assignments_org_write on user_role_assignments;
drop policy if exists access_review_campaigns_org_write on access_review_campaigns;
drop policy if exists access_review_items_org_write on access_review_items;
drop policy if exists emergency_access_events_org_write on emergency_access_events;
drop policy if exists findings_org_write on findings;
drop policy if exists policies_org_write on policies;
drop policy if exists controls_org_write on controls;
drop policy if exists vendors_org_write on vendors;
drop policy if exists training_courses_org_write on training_courses;
drop policy if exists training_assignments_org_write on training_assignments;
drop policy if exists policy_acknowledgements_org_write on policy_acknowledgements;
drop policy if exists sanctions_log_org_write on sanctions_log;
drop policy if exists incidents_org_write on incidents;
drop policy if exists breach_notifications_org_write on breach_notifications;
drop policy if exists generated_reports_org_write on generated_reports;
drop policy if exists scheduled_reports_org_write on scheduled_reports;
drop policy if exists audit_packages_org_write on audit_packages;
drop policy if exists alert_rules_org_write on alert_rules;
drop policy if exists integration_connections_org_write on integration_connections;
drop policy if exists billing_subscriptions_org_write on billing_subscriptions;
drop policy if exists feature_records_org_write on feature_records;
drop policy if exists app_role_permissions_via_role on app_role_permissions;
drop policy if exists policy_versions_via_policy on policy_versions;
drop policy if exists vendor_certifications_via_vendor on vendor_certifications;
drop policy if exists vendor_subcontractors_via_vendor on vendor_subcontractors;
drop policy if exists org_memberships_select on organization_memberships;
drop policy if exists org_memberships_admin_insert on organization_memberships;
drop policy if exists org_memberships_admin_update on organization_memberships;

alter table organization_memberships
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists is_owner boolean not null default false,
  add column if not exists invited_by uuid references auth.users(id),
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists status text not null default 'active',
  add column if not exists last_active_at timestamptz,
  add column if not exists notes text,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists department text;

update organization_memberships
set id = gen_random_uuid()
where id is null;

create unique index if not exists organization_memberships_id_key
  on organization_memberships(id);

alter table organization_memberships
  alter column id set not null;

update organization_memberships
set is_owner = true
where role::text = 'owner';

alter table organization_memberships
  alter column role drop default;

alter table organization_memberships
  alter column role type text using (
    case role::text
      when 'owner' then 'admin'
      when 'hr_manager' then 'compliance_manager'
      when 'billing_manager' then 'admin'
      when 'manager' then 'compliance_manager'
      else role::text
    end
  );

update organization_memberships
set is_owner = true
where role = 'admin'
  and (
    is_owner = true
    or (organization_id, user_id) in (
      select distinct on (organization_id) organization_id, user_id
      from organization_memberships
      where role = 'admin'
      order by organization_id, created_at asc
    )
  );

alter table organization_memberships
  alter column role set default 'auditor',
  alter column role set not null;

do $$
begin
  alter table organization_memberships
    add constraint organization_memberships_role_check
    check (role in (
      'admin',
      'privacy_officer',
      'security_officer',
      'compliance_manager',
      'auditor',
      'data_analyst',
      'developer'
    ));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table organization_memberships
    add constraint organization_memberships_status_check
    check (status in ('pending', 'active', 'suspended', 'removed'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_org_memberships_org_status
  on organization_memberships(organization_id, status);

create index if not exists idx_org_memberships_email
  on organization_memberships(lower(email))
  where email is not null;

create table if not exists organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text,
  email text not null,
  role text not null,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  resent_at timestamptz,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invitations_role_check check (role in (
    'admin',
    'privacy_officer',
    'security_officer',
    'compliance_manager',
    'auditor',
    'data_analyst',
    'developer'
  )),
  constraint organization_invitations_status_check check (status in (
    'pending',
    'accepted',
    'expired',
    'revoked'
  ))
);

create unique index if not exists organization_invitations_pending_email_org_key
  on organization_invitations(organization_id, lower(email))
  where status = 'pending';

create index if not exists idx_organization_invitations_email_status
  on organization_invitations(lower(email), status);

create table if not exists role_change_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  action text not null,
  old_role text,
  new_role text,
  reason text,
  created_at timestamptz not null default now(),
  constraint role_change_log_action_check check (action in (
    'invited',
    'invite_accepted',
    'role_changed',
    'suspended',
    'reactivated',
    'removed'
  ))
);

create index if not exists idx_role_change_log_org_created
  on role_change_log(organization_id, created_at desc);

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'admin'
  );
$$;

create or replace function public.is_org_owner(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'admin'
      and m.is_owner
  );
$$;

create or replace function public.can_review_org_access(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('admin', 'security_officer', 'compliance_manager', 'auditor')
  );
$$;

revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.is_org_owner(uuid) from public;
revoke all on function public.can_review_org_access(uuid) from public;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.can_review_org_access(uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'scan_schedules',
    'phi_inventory_assets',
    'deidentification_checks',
    'access_policies',
    'app_roles',
    'user_role_assignments',
    'access_review_campaigns',
    'access_review_items',
    'emergency_access_events',
    'findings',
    'policies',
    'controls',
    'vendors',
    'training_courses',
    'training_assignments',
    'policy_acknowledgements',
    'sanctions_log',
    'incidents',
    'breach_notifications',
    'generated_reports',
    'scheduled_reports',
    'audit_packages',
    'alert_rules',
    'integration_connections',
    'billing_subscriptions'
  ]
  loop
    execute format(
      'create policy %I_org_write on %I for all using (exists (select 1 from organization_memberships m where m.organization_id = %I.organization_id and m.user_id = auth.uid() and m.role in (''admin'',''security_officer'',''privacy_officer'',''compliance_manager'') and m.status = ''active''));',
      t,
      t,
      t
    );
  end loop;
end $$;

create policy app_roles_org_select on app_roles
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = app_roles.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create policy user_role_assignments_org_select on user_role_assignments
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = user_role_assignments.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create policy feature_records_org_write on feature_records
for all using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = feature_records.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin','security_officer','privacy_officer','compliance_manager','developer')
      and m.status = 'active'
  )
);

create policy app_role_permissions_via_role on app_role_permissions
for all using (
  exists (
    select 1
    from app_roles r
    join organization_memberships m on m.organization_id = r.organization_id
    where r.id = app_role_permissions.role_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create policy policy_versions_via_policy on policy_versions
for all using (
  exists (
    select 1
    from policies p
    join organization_memberships m on m.organization_id = p.organization_id
    where p.id = policy_versions.policy_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create policy vendor_certifications_via_vendor on vendor_certifications
for all using (
  exists (
    select 1
    from vendors v
    join organization_memberships m on m.organization_id = v.organization_id
    where v.id = vendor_certifications.vendor_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create policy vendor_subcontractors_via_vendor on vendor_subcontractors
for all using (
  exists (
    select 1
    from vendors v
    join organization_memberships m on m.organization_id = v.organization_id
    where v.id = vendor_subcontractors.vendor_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create or replace function public.accept_pending_organization_invitations()
returns table(organization_id uuid, membership_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
  invite_row organization_invitations%rowtype;
  inserted_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth.uid() is null';
  end if;

  user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if user_email = '' then
    return;
  end if;

  for invite_row in
    select *
    from organization_invitations
    where lower(email) = user_email
      and status = 'pending'
      and expires_at > now()
    order by created_at asc
  loop
    insert into organization_memberships(
      organization_id,
      user_id,
      role,
      is_owner,
      invited_by,
      invited_at,
      accepted_at,
      status,
      notes,
      full_name,
      email
    )
    values (
      invite_row.organization_id,
      auth.uid(),
      invite_row.role,
      false,
      invite_row.invited_by,
      invite_row.created_at,
      now(),
      'active',
      invite_row.notes,
      invite_row.full_name,
      invite_row.email
    )
    on conflict (organization_id, user_id) do update set
      role = excluded.role,
      status = 'active',
      invited_by = excluded.invited_by,
      invited_at = excluded.invited_at,
      accepted_at = now(),
      notes = excluded.notes,
      full_name = coalesce(excluded.full_name, organization_memberships.full_name),
      email = excluded.email
    returning id into inserted_membership_id;

    insert into user_profiles(user_id, full_name)
    values (auth.uid(), invite_row.full_name)
    on conflict (user_id) do update
      set full_name = coalesce(user_profiles.full_name, excluded.full_name),
          updated_at = now();

    update organization_invitations
    set status = 'accepted',
        accepted_at = now(),
        updated_at = now()
    where id = invite_row.id;

    insert into role_change_log(
      organization_id,
      changed_by,
      target_user_id,
      target_email,
      action,
      new_role,
      reason
    )
    values (
      invite_row.organization_id,
      invite_row.invited_by,
      auth.uid(),
      invite_row.email,
      'invite_accepted',
      invite_row.role,
      'User accepted pending invitation'
    );

    organization_id := invite_row.organization_id;
    membership_id := inserted_membership_id;
    return next;
  end loop;
end;
$$;

revoke all on function public.accept_pending_organization_invitations() from public;
grant execute on function public.accept_pending_organization_invitations() to authenticated;

create or replace function bootstrap_organization_for_current_user(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth.uid() is null';
  end if;

  insert into organizations(name)
  values (coalesce(nullif(trim(org_name), ''), 'MedLock Organization'))
  returning id into new_org_id;

  insert into organization_memberships(
    organization_id,
    user_id,
    role,
    is_owner,
    status,
    accepted_at,
    email
  )
  values (
    new_org_id,
    auth.uid(),
    'admin',
    true,
    'active',
    now(),
    auth.jwt() ->> 'email'
  );

  insert into user_profiles(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  return new_org_id;
end;
$$;

grant execute on function bootstrap_organization_for_current_user(text) to authenticated;

alter table organization_invitations enable row level security;
alter table role_change_log enable row level security;

drop policy if exists org_memberships_select on organization_memberships;
create policy org_memberships_select on organization_memberships
for select using (
  user_id = auth.uid()
  or public.is_org_admin(organization_id)
  or public.can_review_org_access(organization_id)
);

drop policy if exists org_memberships_admin_insert on organization_memberships;
create policy org_memberships_admin_insert on organization_memberships
for insert with check (
  public.is_org_admin(organization_id)
);

drop policy if exists org_memberships_admin_update on organization_memberships;
create policy org_memberships_admin_update on organization_memberships
for update using (
  public.is_org_admin(organization_id)
)
with check (
  public.is_org_admin(organization_id)
);

drop policy if exists organization_invitations_select on organization_invitations;
create policy organization_invitations_select on organization_invitations
for select using (
  public.is_org_admin(organization_id)
  or (
    status = 'pending'
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists organization_invitations_insert on organization_invitations;
create policy organization_invitations_insert on organization_invitations
for insert with check (
  public.is_org_admin(organization_id)
);

drop policy if exists organization_invitations_update on organization_invitations;
create policy organization_invitations_update on organization_invitations
for update using (
  public.is_org_admin(organization_id)
)
with check (
  public.is_org_admin(organization_id)
);

drop policy if exists role_change_log_select on role_change_log;
create policy role_change_log_select on role_change_log
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = role_change_log.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists role_change_log_admin_insert on role_change_log;
create policy role_change_log_admin_insert on role_change_log
for insert with check (
  public.is_org_admin(organization_id)
);

drop type if exists membership_role cascade;
