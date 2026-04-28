create table if not exists deid_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  dataset_label text not null,
  standard text not null check (standard in ('safe_harbor', 'expert_determination')),
  tool text not null check (tool in ('checker', 'deidentifier')),
  status text not null check (status in ('pending', 'running', 'pass', 'fail', 'needs_expert', 'error')),
  row_count int,
  column_count int,
  columns_detected jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  identifier_count int not null default 0,
  passed_identifiers text[] not null default '{}',
  failed_identifiers text[] not null default '{}',
  reidentification_risk numeric,
  kanonymity_value int,
  quasi_identifiers text[] not null default '{}',
  expert_reviewer_id uuid references auth.users(id) on delete set null,
  expert_reviewed_at timestamptz,
  expert_credentials text,
  expert_notes text,
  remediation_of uuid references deid_assessments(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists deid_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  assessment_id uuid references deid_assessments(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  dataset_label text not null,
  status text not null check (status in ('pending', 'running', 'complete', 'error')),
  row_count int,
  column_count int,
  column_mapping jsonb not null default '[]'::jsonb,
  transformations_applied jsonb not null default '[]'::jsonb,
  output_row_count int,
  output_column_count int,
  suppressed_rows int not null default 0,
  output_storage_path text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_deid_assessments_org_created_at on deid_assessments(organization_id, created_at desc);
create index if not exists idx_deid_assessments_org_status on deid_assessments(organization_id, status);
create index if not exists idx_deid_assessments_remediation on deid_assessments(remediation_of);
create index if not exists idx_deid_jobs_org_created_at on deid_jobs(organization_id, created_at desc);
create index if not exists idx_deid_jobs_org_status on deid_jobs(organization_id, status);

alter table deid_assessments enable row level security;
alter table deid_jobs enable row level security;

drop policy if exists deid_assessments_org_select on deid_assessments;
create policy deid_assessments_org_select on deid_assessments
for select using (
  exists (
    select 1 from organization_memberships m
    where m.organization_id = deid_assessments.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists deid_assessments_org_write on deid_assessments;
create policy deid_assessments_org_write on deid_assessments
for all using (
  exists (
    select 1 from organization_memberships m
    where m.organization_id = deid_assessments.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from organization_memberships m
    where m.organization_id = deid_assessments.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists deid_jobs_org_select on deid_jobs;
create policy deid_jobs_org_select on deid_jobs
for select using (
  exists (
    select 1 from organization_memberships m
    where m.organization_id = deid_jobs.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists deid_jobs_org_write on deid_jobs;
create policy deid_jobs_org_write on deid_jobs
for all using (
  exists (
    select 1 from organization_memberships m
    where m.organization_id = deid_jobs.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from organization_memberships m
    where m.organization_id = deid_jobs.organization_id
      and m.user_id = auth.uid()
  )
);
