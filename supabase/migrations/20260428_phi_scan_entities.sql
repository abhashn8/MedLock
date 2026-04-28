-- PHI scanner entities for dedicated scanner workflow.
-- Adds scan metadata, normalized findings, schedules, and storage bucket policies.

create table if not exists phi_scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_name text not null,
  source_type text not null check (source_type in ('github', 'upload')),
  status text not null check (status in ('pending', 'running', 'complete', 'error')),
  triggered_by text not null,
  file_path text not null,
  progress_percent int not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  progress_message text,
  error_message text
);

create table if not exists phi_findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references phi_scans(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  source text not null,
  module text,
  phi_type text not null,
  severity text not null check (severity in ('Critical', 'High', 'Medium', 'Low', 'Informational')),
  title text,
  line_number int,
  evidence text not null,
  description text,
  recommendation text not null,
  hipaa_reference text,
  soc2_criteria text,
  cwe text,
  status text not null default 'open' check (status in ('open', 'false_positive', 'resolved')),
  false_positive_reason text,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phi_scan_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  next_run timestamptz not null,
  last_run timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_phi_scans_org_created
  on phi_scans(organization_id, created_at desc);

create index if not exists idx_phi_scans_status
  on phi_scans(status, created_at desc);

create index if not exists idx_phi_findings_scan_severity
  on phi_findings(scan_id, severity);

create index if not exists idx_phi_findings_org_status
  on phi_findings(organization_id, status);

create index if not exists idx_phi_scan_schedules_org_next_run
  on phi_scan_schedules(organization_id, next_run asc);

drop trigger if exists trg_phi_scans_updated_at on phi_scans;
create trigger trg_phi_scans_updated_at
before update on phi_scans
for each row execute function set_updated_at();

drop trigger if exists trg_phi_findings_updated_at on phi_findings;
create trigger trg_phi_findings_updated_at
before update on phi_findings
for each row execute function set_updated_at();

drop trigger if exists trg_phi_scan_schedules_updated_at on phi_scan_schedules;
create trigger trg_phi_scan_schedules_updated_at
before update on phi_scan_schedules
for each row execute function set_updated_at();

alter table phi_scans enable row level security;
alter table phi_findings enable row level security;
alter table phi_scan_schedules enable row level security;

drop policy if exists phi_scans_org_select on phi_scans;
create policy phi_scans_org_select on phi_scans
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_scans.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists phi_scans_org_write on phi_scans;
create policy phi_scans_org_write on phi_scans
for all using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_scans.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_scans.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists phi_findings_org_select on phi_findings;
create policy phi_findings_org_select on phi_findings
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_findings.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists phi_findings_org_write on phi_findings;
create policy phi_findings_org_write on phi_findings
for all using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_findings.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_findings.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists phi_scan_schedules_org_select on phi_scan_schedules;
create policy phi_scan_schedules_org_select on phi_scan_schedules
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_scan_schedules.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists phi_scan_schedules_org_write on phi_scan_schedules;
create policy phi_scan_schedules_org_write on phi_scan_schedules
for all using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_scan_schedules.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_scan_schedules.organization_id
      and m.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('phi-scans', 'phi-scans', false)
on conflict (id) do nothing;

drop policy if exists phi_scans_bucket_select on storage.objects;
create policy phi_scans_bucket_select on storage.objects
for select to authenticated
using (bucket_id = 'phi-scans' and owner = auth.uid());

drop policy if exists phi_scans_bucket_insert on storage.objects;
create policy phi_scans_bucket_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'phi-scans' and owner = auth.uid());

drop policy if exists phi_scans_bucket_update on storage.objects;
create policy phi_scans_bucket_update on storage.objects
for update to authenticated
using (bucket_id = 'phi-scans' and owner = auth.uid())
with check (bucket_id = 'phi-scans' and owner = auth.uid());

drop policy if exists phi_scans_bucket_delete on storage.objects;
create policy phi_scans_bucket_delete on storage.objects
for delete to authenticated
using (bucket_id = 'phi-scans' and owner = auth.uid());
