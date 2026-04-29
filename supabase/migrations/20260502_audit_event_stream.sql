create table if not exists public.audit_event_stream (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_uid text not null,
  source text not null check (source in ('app', 'platform')),
  category text not null,
  action text not null,
  actor text null,
  resource text null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, event_uid)
);

create index if not exists idx_audit_event_stream_org_timestamp
  on public.audit_event_stream(organization_id, timestamp desc);

create index if not exists idx_audit_event_stream_org_source
  on public.audit_event_stream(organization_id, source);

alter table public.audit_event_stream enable row level security;

drop policy if exists audit_event_stream_select on public.audit_event_stream;
create policy audit_event_stream_select
on public.audit_event_stream
for select
using (
  exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = audit_event_stream.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists audit_event_stream_insert on public.audit_event_stream;
create policy audit_event_stream_insert
on public.audit_event_stream
for insert
with check (
  exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = audit_event_stream.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists audit_event_stream_update on public.audit_event_stream;
create policy audit_event_stream_update
on public.audit_event_stream
for update
using (
  exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = audit_event_stream.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = audit_event_stream.organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);
