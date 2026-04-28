-- HIPAA Shield core schema
-- Covers dashboard feature modules + existing scanner tables.

create extension if not exists pgcrypto;

do $$
begin
  create type membership_role as enum ('owner', 'admin', 'security_officer', 'privacy_officer', 'compliance_manager', 'developer', 'auditor', 'hr_manager', 'billing_manager', 'manager');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type hs_severity as enum ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type hs_status as enum ('PASS', 'FAIL', 'WARNING', 'PENDING');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type incident_status as enum ('INTAKE', 'TRIAGE', 'INVESTIGATING', 'MONITORING', 'RESOLVED', 'CLOSED');
exception when duplicate_object then null;
end $$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  contact_email text,
  timezone text default 'UTC',
  hipaa_reference text default '45 CFR Parts 160 & 164',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_memberships (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role membership_role not null default 'developer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role_title text,
  department text,
  manager_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing app tables used by backend scanner routes
create table if not exists github_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  github_access_token text not null,
  github_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  repo_owner text not null,
  repo_name text not null,
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scan_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_type text not null, -- github_repo, database, s3, email
  source_ref text not null,
  cron_expr text not null,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phi_inventory_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  system_name text not null,
  data_types text[] not null default '{}',
  classification text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  retention_policy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deidentification_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  mode text not null check (mode in ('SAFE_HARBOR', 'EXPERT_DETERMINATION')),
  result hs_status not null default 'PENDING',
  identifiers_found text[] not null default '{}',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists access_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  policy_key text not null, -- mfa_enforcement, session_timeout, password_policy
  policy_value jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, policy_key)
);

create table if not exists app_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists app_role_permissions (
  role_id uuid not null references app_roles(id) on delete cascade,
  permission_key text not null,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create table if not exists user_role_assignments (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references app_roles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, role_id)
);

create table if not exists access_review_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  status hs_status not null default 'PENDING',
  due_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists access_review_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references access_review_campaigns(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  system_name text not null,
  manager_user_id uuid references auth.users(id) on delete set null,
  decision hs_status not null default 'PENDING',
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists emergency_access_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_resource text not null,
  reason text not null,
  reviewed boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source text not null, -- scanner, risk, incident, vendor, training
  title text not null,
  description text,
  severity hs_severity not null default 'MEDIUM',
  status hs_status not null default 'PENDING',
  owner_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists finding_activities (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references findings(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  policy_type text not null, -- privacy, security, breach_notification, sanctions
  title text not null,
  current_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, title)
);

create table if not exists policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id) on delete cascade,
  version text not null,
  document_url text,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (policy_id, version)
);

create table if not exists controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  control_code text not null, -- e.g. 164.312(a)(1)
  safeguard_domain text not null check (safeguard_domain in ('ADMINISTRATIVE', 'PHYSICAL', 'TECHNICAL')),
  title text not null,
  status hs_status not null default 'PENDING',
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, control_code)
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  baa_status hs_status not null default 'PENDING',
  baa_signed_at date,
  baa_expires_at date,
  covered_services text,
  risk_score int check (risk_score >= 0 and risk_score <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists vendor_certifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  cert_type text not null, -- SOC2, HITRUST, ISO27001
  valid_until date,
  evidence_url text,
  created_at timestamptz not null default now()
);

create table if not exists vendor_subcontractors (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  name text not null,
  baa_status hs_status not null default 'PENDING',
  created_at timestamptz not null default now()
);

create table if not exists training_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  category text not null, -- privacy, security, breach_awareness
  duration_minutes int,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists training_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  course_id uuid not null references training_courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_at timestamptz,
  status hs_status not null default 'PENDING',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);

create table if not exists policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  policy_version_id uuid not null references policy_versions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz,
  status hs_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (policy_version_id, user_id)
);

create table if not exists sanctions_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  violation_type text not null,
  action_taken text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  severity hs_severity not null default 'MEDIUM',
  status incident_status not null default 'INTAKE',
  reported_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  affected_count int,
  breach_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists incident_timeline_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists breach_notifications (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null unique references incidents(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  hhs_due_at timestamptz,
  hhs_notified_at timestamptz,
  notification_letter_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists generated_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  report_type text not null,
  date_range daterange,
  format text not null check (format in ('PDF', 'CSV', 'ZIP')),
  generated_by uuid references auth.users(id) on delete set null,
  file_url text,
  created_at timestamptz not null default now()
);

create table if not exists scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  report_type text not null,
  cron_expr text not null,
  recipients text[] not null default '{}',
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  package_type text not null, -- OCR, INTERNAL, HITRUST, SOC2
  status hs_status not null default 'PENDING',
  generated_report_id uuid references generated_reports(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_key text not null,
  min_severity hs_severity not null default 'MEDIUM',
  recipients text[] not null default '{}',
  channels text[] not null default '{"email"}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  integration_key text not null, -- siem, ehr, slack, cloud
  status hs_status not null default 'PENDING',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, integration_key)
);

create table if not exists billing_subscriptions (
  organization_id uuid primary key references organizations(id) on delete cascade,
  plan_tier text not null default 'starter',
  billing_email text,
  renewal_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations','user_profiles','github_connections','scans','scan_schedules','phi_inventory_assets',
    'access_policies','app_roles','access_review_campaigns','findings','policies','controls',
    'vendors','training_courses','training_assignments','incidents','breach_notifications',
    'scheduled_reports','audit_packages','alert_rules','integration_connections','billing_subscriptions'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on %I;', t, t);
    execute format('create trigger trg_%I_updated_at before update on %I for each row execute function set_updated_at();', t, t);
  end loop;
end $$;

-- Indexes
create index if not exists idx_scans_user_created_at on scans(user_id, created_at desc);
create index if not exists idx_findings_org_status_severity on findings(organization_id, status, severity);
create index if not exists idx_training_assignments_org_status_due on training_assignments(organization_id, status, due_at);
create index if not exists idx_access_review_items_org_decision on access_review_items(organization_id, decision);
create index if not exists idx_vendors_org_baa_expires on vendors(organization_id, baa_expires_at);
create index if not exists idx_incidents_org_status_severity on incidents(organization_id, status, severity);
create index if not exists idx_generated_reports_org_created on generated_reports(organization_id, created_at desc);
create index if not exists idx_controls_org_status on controls(organization_id, status);
create index if not exists idx_policy_ack_org_status on policy_acknowledgements(organization_id, status);

-- RLS
alter table organizations enable row level security;
alter table organization_memberships enable row level security;
alter table user_profiles enable row level security;
alter table github_connections enable row level security;
alter table scans enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'scan_schedules','phi_inventory_assets','deidentification_checks','access_policies','app_roles','app_role_permissions',
    'user_role_assignments','access_review_campaigns','access_review_items','emergency_access_events','findings',
    'finding_activities','policies','policy_versions','controls','vendors','vendor_certifications','vendor_subcontractors',
    'training_courses','training_assignments','policy_acknowledgements','sanctions_log','incidents','incident_timeline_events',
    'breach_notifications','generated_reports','scheduled_reports','audit_packages','alert_rules','integration_connections',
    'billing_subscriptions'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Membership checks
drop policy if exists org_select on organizations;
create policy org_select on organizations
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = organizations.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists org_memberships_select on organization_memberships;
create policy org_memberships_select on organization_memberships
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from organization_memberships m
    where m.organization_id = organization_memberships.organization_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

drop policy if exists user_profiles_select on user_profiles;
create policy user_profiles_select on user_profiles
for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from organization_memberships om_self
    join organization_memberships om_target on om_target.organization_id = om_self.organization_id
    where om_self.user_id = auth.uid()
      and om_target.user_id = user_profiles.user_id
  )
);

-- Existing scanner tables: user-scoped
drop policy if exists github_connections_owner_rw on github_connections;
create policy github_connections_owner_rw on github_connections
for all using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists scans_owner_rw on scans;
create policy scans_owner_rw on scans
for all using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Org-scoped policy helper generated across tables with organization_id
do $$
declare
  t text;
begin
  foreach t in array array[
    'scan_schedules','phi_inventory_assets','deidentification_checks','access_policies','app_roles',
    'user_role_assignments','access_review_campaigns','access_review_items','emergency_access_events',
    'findings','policies','controls','vendors','training_courses','training_assignments',
    'policy_acknowledgements','sanctions_log','incidents','breach_notifications','generated_reports',
    'scheduled_reports','audit_packages','alert_rules','integration_connections','billing_subscriptions'
  ]
  loop
    execute format('drop policy if exists %I_org_select on %I;', t, t);
    execute format('create policy %I_org_select on %I for select using (exists (select 1 from organization_memberships m where m.organization_id = %I.organization_id and m.user_id = auth.uid()));', t, t, t);

    execute format('drop policy if exists %I_org_write on %I;', t, t);
    execute format('create policy %I_org_write on %I for all using (exists (select 1 from organization_memberships m where m.organization_id = %I.organization_id and m.user_id = auth.uid() and m.role in (''owner'',''admin'',''security_officer'',''privacy_officer'',''compliance_manager''))) with check (exists (select 1 from organization_memberships m where m.organization_id = %I.organization_id and m.user_id = auth.uid() and m.role in (''owner'',''admin'',''security_officer'',''privacy_officer'',''compliance_manager'')));', t, t, t, t);
  end loop;
end $$;

-- Child tables that inherit org permissions through parent relationship
drop policy if exists app_role_permissions_via_role on app_role_permissions;
create policy app_role_permissions_via_role on app_role_permissions
for all using (
  exists (
    select 1
    from app_roles r
    join organization_memberships m on m.organization_id = r.organization_id
    where r.id = app_role_permissions.role_id
      and m.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from app_roles r
    join organization_memberships m on m.organization_id = r.organization_id
    where r.id = app_role_permissions.role_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin','security_officer','privacy_officer','compliance_manager')
  )
);

drop policy if exists finding_activities_via_finding on finding_activities;
create policy finding_activities_via_finding on finding_activities
for all using (
  exists (
    select 1
    from findings f
    join organization_memberships m on m.organization_id = f.organization_id
    where f.id = finding_activities.finding_id
      and m.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from findings f
    join organization_memberships m on m.organization_id = f.organization_id
    where f.id = finding_activities.finding_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists policy_versions_via_policy on policy_versions;
create policy policy_versions_via_policy on policy_versions
for all using (
  exists (
    select 1
    from policies p
    join organization_memberships m on m.organization_id = p.organization_id
    where p.id = policy_versions.policy_id
      and m.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from policies p
    join organization_memberships m on m.organization_id = p.organization_id
    where p.id = policy_versions.policy_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin','privacy_officer','compliance_manager')
  )
);

drop policy if exists vendor_certifications_via_vendor on vendor_certifications;
create policy vendor_certifications_via_vendor on vendor_certifications
for all using (
  exists (
    select 1
    from vendors v
    join organization_memberships m on m.organization_id = v.organization_id
    where v.id = vendor_certifications.vendor_id
      and m.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from vendors v
    join organization_memberships m on m.organization_id = v.organization_id
    where v.id = vendor_certifications.vendor_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin','security_officer','privacy_officer','compliance_manager')
  )
);

drop policy if exists vendor_subcontractors_via_vendor on vendor_subcontractors;
create policy vendor_subcontractors_via_vendor on vendor_subcontractors
for all using (
  exists (
    select 1
    from vendors v
    join organization_memberships m on m.organization_id = v.organization_id
    where v.id = vendor_subcontractors.vendor_id
      and m.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from vendors v
    join organization_memberships m on m.organization_id = v.organization_id
    where v.id = vendor_subcontractors.vendor_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin','security_officer','privacy_officer','compliance_manager')
  )
);

drop policy if exists incident_timeline_via_incident on incident_timeline_events;
create policy incident_timeline_via_incident on incident_timeline_events
for all using (
  exists (
    select 1
    from incidents i
    join organization_memberships m on m.organization_id = i.organization_id
    where i.id = incident_timeline_events.incident_id
      and m.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from incidents i
    join organization_memberships m on m.organization_id = i.organization_id
    where i.id = incident_timeline_events.incident_id
      and m.user_id = auth.uid()
  )
);

-- Helpful view for dashboard top KPIs
create or replace view dashboard_kpi_summary as
select
  o.id as organization_id,
  count(distinct f.id) filter (where f.status in ('FAIL','WARNING','PENDING')) as open_findings,
  count(distinct i.id) filter (where i.status in ('INTAKE','TRIAGE','INVESTIGATING','MONITORING')) as active_incidents,
  count(distinct ta.id) filter (where ta.status <> 'PASS' and ta.due_at is not null and ta.due_at < now()) as overdue_training,
  count(distinct v.id) filter (where v.baa_expires_at is not null and v.baa_expires_at <= (current_date + interval '60 day')) as baa_expiring_soon
from organizations o
left join findings f on f.organization_id = o.id
left join incidents i on i.organization_id = o.id
left join training_assignments ta on ta.organization_id = o.id
left join vendors v on v.organization_id = o.id
group by o.id;

-- Bootstrap helper: call once per new user after auth signup
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
  values (coalesce(nullif(trim(org_name), ''), 'HIPAA Shield Organization'))
  returning id into new_org_id;

  insert into organization_memberships(organization_id, user_id, role)
  values (new_org_id, auth.uid(), 'owner');

  insert into user_profiles(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  return new_org_id;
end;
$$;

grant execute on function bootstrap_organization_for_current_user(text) to authenticated;
