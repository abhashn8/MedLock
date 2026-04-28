-- PHI Inventory: human-verified catalog (phi_systems + phi_system_reviews).
-- Replaces placeholder-only usage of phi_inventory_assets with structured rows; legacy rows migrated.

-- Allowed PHI type literals (application validates; DB stores text[]).
-- classification, system_type, access_control_method, retention_legal_basis, review_cadence, source, status: CHECK below.

create table if not exists phi_systems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  system_type text not null default 'other'
    check (system_type in ('database', 'object_storage', 'api', 'saas', 'email', 'file_share', 'backup', 'other')),
  host_or_url text,
  department text not null default 'General',
  classification text not null
    check (classification in ('clinical', 'direct_identifier', 'financial', 'contact', 'derived')),
  phi_types text[] not null default '{}',
  business_owner_id uuid references auth.users(id) on delete set null,
  technical_owner_id uuid references auth.users(id) on delete set null,
  encryption_at_rest boolean not null default false,
  encryption_at_rest_method text,
  encryption_in_transit boolean not null default false,
  encryption_in_transit_protocol text,
  access_control_method text not null default 'none'
    check (access_control_method in ('rbac', 'iam', 'password', 'none')),
  baa_required boolean not null default false,
  baa_id uuid,
  retention_years int,
  retention_legal_basis text
    check (retention_legal_basis is null or retention_legal_basis in ('hipaa_minimum', 'state_law', 'contract', 'custom')),
  retention_notes text,
  review_cadence text not null default 'annual'
    check (review_cadence in ('quarterly', 'semi_annual', 'annual')),
  last_reviewed_at timestamptz,
  next_review_due_at timestamptz,
  source text not null default 'manual'
    check (source in ('manual', 'scanner')),
  phi_scan_id uuid references phi_scans(id) on delete set null,
  status text not null default 'needs_review'
    check (status in ('active', 'needs_review', 'at_risk', 'decommissioned')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_phi_systems_org on phi_systems(organization_id);
create index if not exists idx_phi_systems_org_status on phi_systems(organization_id, status);
create index if not exists idx_phi_systems_org_next_review on phi_systems(organization_id, next_review_due_at);
create index if not exists idx_phi_systems_phi_scan on phi_systems(phi_scan_id) where phi_scan_id is not null;

drop trigger if exists trg_phi_systems_updated_at on phi_systems;
create trigger trg_phi_systems_updated_at
before update on phi_systems
for each row execute function set_updated_at();

create table if not exists phi_system_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  system_id uuid not null references phi_systems(id) on delete cascade,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  changes_made text,
  next_review_due_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_phi_system_reviews_system on phi_system_reviews(system_id, reviewed_at desc);
create index if not exists idx_phi_system_reviews_org on phi_system_reviews(organization_id);

alter table phi_systems enable row level security;
alter table phi_system_reviews enable row level security;

drop policy if exists phi_systems_org_select on phi_systems;
create policy phi_systems_org_select on phi_systems
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_systems.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists phi_systems_org_write on phi_systems;
create policy phi_systems_org_write on phi_systems
for all using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_systems.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_systems.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists phi_system_reviews_org_select on phi_system_reviews;
create policy phi_system_reviews_org_select on phi_system_reviews
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_system_reviews.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists phi_system_reviews_org_insert on phi_system_reviews;
create policy phi_system_reviews_org_insert on phi_system_reviews
for insert with check (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_system_reviews.organization_id
      and m.user_id = auth.uid()
  )
);

-- Migrate legacy phi_inventory_assets → phi_systems (best-effort mapping).
insert into phi_systems (
  organization_id,
  name,
  description,
  system_type,
  department,
  classification,
  phi_types,
  business_owner_id,
  technical_owner_id,
  encryption_at_rest,
  encryption_in_transit,
  access_control_method,
  baa_required,
  retention_years,
  retention_notes,
  review_cadence,
  source,
  status,
  notes,
  created_at,
  updated_at
)
select
  a.organization_id,
  a.system_name,
  null::text,
  'other'::text,
  coalesce(p.department, 'General')::text,
  case
    when lower(a.classification) like '%clinical%' then 'clinical'
    when lower(a.classification) like '%direct%' or lower(a.classification) like '%identifier%' then 'direct_identifier'
    when lower(a.classification) like '%financial%' then 'financial'
    when lower(a.classification) like '%contact%' then 'contact'
    else 'derived'
  end,
  case
    when cardinality(a.data_types) = 0 then array['other']::text[]
    else (
      select coalesce(array_agg(
        case
          when lower(trim(b)) in (
            'ssn', 'mrn', 'dob', 'name', 'email', 'phone', 'fax', 'address',
            'zip', 'dates', 'age_over_89', 'diagnosis', 'insurance_id', 'account_number',
            'certificate_number', 'device_identifier', 'ip_address', 'biometric',
            'photo', 'url', 'bank_account', 'other'
          ) then lower(trim(b))
          else 'other'
        end
      ), array['other']::text[])
      from unnest(a.data_types) as b
    )
  end,
  a.owner_user_id,
  null::uuid,
  false,
  false,
  'none'::text,
  false,
  null::int,
  a.retention_policy,
  'annual'::text,
  'manual'::text,
  'needs_review'::text,
  'Migrated from phi_inventory_assets'::text,
  a.created_at,
  a.updated_at
from phi_inventory_assets a
left join user_profiles p on p.user_id = a.owner_user_id
where not exists (
  select 1
  from phi_systems s
  where s.organization_id = a.organization_id
    and s.name = a.system_name
    and s.source = 'manual'
);
