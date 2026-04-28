-- Generic module CRUD store for dashboard routes.
-- Run after core migration.

create table if not exists feature_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  module_key text not null,
  title text not null,
  description text,
  status hs_status not null default 'PENDING',
  severity hs_severity not null default 'MEDIUM',
  due_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feature_records_org_module_created
  on feature_records(organization_id, module_key, created_at desc);

drop trigger if exists trg_feature_records_updated_at on feature_records;
create trigger trg_feature_records_updated_at
before update on feature_records
for each row execute function set_updated_at();

alter table feature_records enable row level security;

drop policy if exists feature_records_org_select on feature_records;
create policy feature_records_org_select on feature_records
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = feature_records.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists feature_records_org_write on feature_records;
create policy feature_records_org_write on feature_records
for all using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = feature_records.organization_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin','security_officer','privacy_officer','compliance_manager','developer','manager')
  )
)
with check (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = feature_records.organization_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin','security_officer','privacy_officer','compliance_manager','developer','manager')
  )
);
