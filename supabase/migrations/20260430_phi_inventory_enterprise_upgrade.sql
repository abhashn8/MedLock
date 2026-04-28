-- PHI Inventory enterprise upgrade (no reminder scheduler scope).

alter table phi_systems
  add column if not exists risk_score int not null default 0,
  add column if not exists state_jurisdiction text,
  add column if not exists decommission_method text,
  add column if not exists decommission_date date,
  add column if not exists decommission_authorized_by uuid references auth.users(id) on delete set null,
  add column if not exists decommission_successor_system text,
  add column if not exists decommission_legal_hold_ref text,
  add column if not exists decommission_notes text,
  add column if not exists decommission_certificate_number text;

alter table phi_system_reviews
  add column if not exists reviewer_role text,
  add column if not exists cosigner_id uuid references auth.users(id) on delete set null,
  add column if not exists cosigner_role text,
  add column if not exists cosigned_at timestamptz,
  add column if not exists checklist_confirmed boolean not null default false,
  add column if not exists certificate_number text,
  add column if not exists certificate_generated_at timestamptz;

update phi_system_reviews
set certificate_number = concat('CERT-', upper(substr(gen_random_uuid()::text, 1, 8)))
where certificate_number is null;

alter table phi_system_reviews
  alter column certificate_number set default concat('CERT-', upper(substr(gen_random_uuid()::text, 1, 8)));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'phi_system_reviews_certificate_number_key'
  ) then
    alter table phi_system_reviews
      add constraint phi_system_reviews_certificate_number_key unique (certificate_number);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'phi_system_reviews_reviewer_role_check'
  ) then
    alter table phi_system_reviews
      add constraint phi_system_reviews_reviewer_role_check
      check (
        reviewer_role is null or reviewer_role in ('privacy_officer', 'compliance_manager', 'system_owner', 'security_officer')
      );
  end if;
end $$;

create table if not exists phi_system_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  system_id uuid not null references phi_systems(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  action text not null check (action in ('created', 'updated', 'reviewed', 'decommissioned')),
  field_name text,
  old_value text,
  new_value text
);

create index if not exists idx_phi_system_audit_log_org_changed_at
  on phi_system_audit_log(organization_id, changed_at desc);
create index if not exists idx_phi_system_audit_log_system_changed_at
  on phi_system_audit_log(system_id, changed_at desc);

alter table phi_system_audit_log enable row level security;

drop policy if exists phi_system_audit_log_org_select on phi_system_audit_log;
create policy phi_system_audit_log_org_select on phi_system_audit_log
for select using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_system_audit_log.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists phi_system_audit_log_org_insert on phi_system_audit_log;
create policy phi_system_audit_log_org_insert on phi_system_audit_log
for insert with check (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_system_audit_log.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists phi_system_audit_log_org_update on phi_system_audit_log;
create policy phi_system_audit_log_org_update on phi_system_audit_log
for update using (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_system_audit_log.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from organization_memberships m
    where m.organization_id = phi_system_audit_log.organization_id
      and m.user_id = auth.uid()
  )
);

create or replace function phi_systems_write_audit_log()
returns trigger
language plpgsql
as $$
declare
  actor uuid := auth.uid();
  org_id uuid;
begin
  if tg_op = 'INSERT' then
    insert into phi_system_audit_log (
      organization_id, system_id, changed_by, action, field_name, old_value, new_value
    ) values (
      new.organization_id, new.id, actor, 'created', null, null, null
    );
    return new;
  end if;

  org_id := new.organization_id;

  if old.status is distinct from new.status and new.status = 'decommissioned' then
    insert into phi_system_audit_log (
      organization_id, system_id, changed_by, action, field_name, old_value, new_value
    ) values (
      org_id, new.id, actor, 'decommissioned', 'status', old.status::text, new.status::text
    );
  end if;

  if old.name is distinct from new.name then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'name', old.name::text, new.name::text);
  end if;
  if old.description is distinct from new.description then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'description', old.description::text, new.description::text);
  end if;
  if old.system_type is distinct from new.system_type then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'system_type', old.system_type::text, new.system_type::text);
  end if;
  if old.host_or_url is distinct from new.host_or_url then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'host_or_url', old.host_or_url::text, new.host_or_url::text);
  end if;
  if old.department is distinct from new.department then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'department', old.department::text, new.department::text);
  end if;
  if old.classification is distinct from new.classification then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'classification', old.classification::text, new.classification::text);
  end if;
  if old.phi_types is distinct from new.phi_types then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'phi_types', old.phi_types::text, new.phi_types::text);
  end if;
  if old.business_owner_id is distinct from new.business_owner_id then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'business_owner_id', old.business_owner_id::text, new.business_owner_id::text);
  end if;
  if old.technical_owner_id is distinct from new.technical_owner_id then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'technical_owner_id', old.technical_owner_id::text, new.technical_owner_id::text);
  end if;
  if old.encryption_at_rest is distinct from new.encryption_at_rest then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'encryption_at_rest', old.encryption_at_rest::text, new.encryption_at_rest::text);
  end if;
  if old.encryption_at_rest_method is distinct from new.encryption_at_rest_method then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'encryption_at_rest_method', old.encryption_at_rest_method::text, new.encryption_at_rest_method::text);
  end if;
  if old.encryption_in_transit is distinct from new.encryption_in_transit then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'encryption_in_transit', old.encryption_in_transit::text, new.encryption_in_transit::text);
  end if;
  if old.encryption_in_transit_protocol is distinct from new.encryption_in_transit_protocol then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'encryption_in_transit_protocol', old.encryption_in_transit_protocol::text, new.encryption_in_transit_protocol::text);
  end if;
  if old.access_control_method is distinct from new.access_control_method then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'access_control_method', old.access_control_method::text, new.access_control_method::text);
  end if;
  if old.baa_required is distinct from new.baa_required then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'baa_required', old.baa_required::text, new.baa_required::text);
  end if;
  if old.baa_id is distinct from new.baa_id then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'baa_id', old.baa_id::text, new.baa_id::text);
  end if;
  if old.retention_years is distinct from new.retention_years then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'retention_years', old.retention_years::text, new.retention_years::text);
  end if;
  if old.retention_legal_basis is distinct from new.retention_legal_basis then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'retention_legal_basis', old.retention_legal_basis::text, new.retention_legal_basis::text);
  end if;
  if old.retention_notes is distinct from new.retention_notes then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'retention_notes', old.retention_notes::text, new.retention_notes::text);
  end if;
  if old.review_cadence is distinct from new.review_cadence then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'review_cadence', old.review_cadence::text, new.review_cadence::text);
  end if;
  if old.status is distinct from new.status then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'status', old.status::text, new.status::text);
  end if;
  if old.notes is distinct from new.notes then
    insert into phi_system_audit_log (organization_id, system_id, changed_by, action, field_name, old_value, new_value)
    values (org_id, new.id, actor, 'updated', 'notes', old.notes::text, new.notes::text);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_phi_systems_audit_write on phi_systems;
create trigger trg_phi_systems_audit_write
after insert or update on phi_systems
for each row execute function phi_systems_write_audit_log();
