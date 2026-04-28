-- Seed sample PHI inventory data for orgs that do not yet have catalog rows.
-- This helps new environments show meaningful dashboard content immediately.

with target_orgs as (
  select o.id as organization_id
  from organizations o
  where not exists (
    select 1
    from phi_systems s
    where s.organization_id = o.id
  )
),
seed_rows as (
  select
    t.organization_id,
    v.name,
    v.description,
    v.system_type,
    v.host_or_url,
    v.department,
    v.classification,
    v.phi_types,
    v.encryption_at_rest,
    v.encryption_at_rest_method,
    v.encryption_in_transit,
    v.encryption_in_transit_protocol,
    v.access_control_method,
    v.baa_required,
    v.retention_years,
    v.retention_legal_basis,
    v.retention_notes,
    v.review_cadence,
    v.last_reviewed_at,
    v.next_review_due_at,
    v.source,
    v.status,
    v.notes
  from target_orgs t
  cross join (
    values
      (
        'EHR Primary Database'::text,
        'Primary production database containing clinical PHI.'::text,
        'database'::text,
        'postgresql://ehr-prod.internal.medlock.local:5432/ehr'::text,
        'Clinical Operations'::text,
        'clinical'::text,
        array['mrn', 'dob', 'name', 'diagnosis']::text[],
        true,
        'AES-256'::text,
        true,
        'TLS 1.3'::text,
        'rbac'::text,
        true,
        7,
        'hipaa_minimum'::text,
        'Retain records for minimum HIPAA period unless legal hold applies.'::text,
        'annual'::text,
        (now() - interval '5 months'),
        (now() + interval '7 months'),
        'manual'::text,
        'active'::text,
        'Core PHI store for clinical workflows.'::text
      ),
      (
        'Patient Messaging API'::text,
        'API serving patient contact and scheduling events.'::text,
        'api'::text,
        'https://api.medlock.local/patient-messaging'::text,
        'Engineering'::text,
        'contact'::text,
        array['name', 'email', 'phone', 'address']::text[],
        true,
        'KMS envelope encryption'::text,
        true,
        'TLS 1.2+'::text,
        'iam'::text,
        true,
        null::int,
        null::text,
        null::text,
        'quarterly'::text,
        null::timestamptz,
        null::timestamptz,
        'manual'::text,
        'at_risk'::text,
        'Needs owner assignment and formal retention policy.'::text
      ),
      (
        'Claims Export S3 Bucket'::text,
        'Nightly claims exports for payer and reconciliation processes.'::text,
        'object_storage'::text,
        's3://medlock-claims-exports-prod'::text,
        'Revenue Cycle'::text,
        'financial'::text,
        array['insurance_id', 'account_number', 'name', 'dob']::text[],
        true,
        'SSE-S3'::text,
        true,
        'TLS 1.2'::text,
        'iam'::text,
        false,
        6,
        'contract'::text,
        'Per payer contract retention terms.'::text,
        'semi_annual'::text,
        (now() - interval '8 months'),
        (now() - interval '2 months'),
        'manual'::text,
        'needs_review'::text,
        'Review cadence overdue; verify BAA requirement for third-party processor.'::text
      ),
      (
        'Legacy Intake Share'::text,
        'Legacy SMB share used for inbound referral packets.'::text,
        'file_share'::text,
        '\\\\legacy-file01\\intake$'::text,
        'Operations'::text,
        'direct_identifier'::text,
        array['name', 'dob', 'ssn', 'address']::text[],
        false,
        null::text,
        false,
        null::text,
        'password'::text,
        false,
        3,
        'state_law'::text,
        'State requirement for referral documents.'::text,
        'annual'::text,
        (now() - interval '14 months'),
        (now() - interval '2 months'),
        'manual'::text,
        'needs_review'::text,
        'Migrating to managed intake service; controls need reassessment.'::text
      )
  ) as v(
    name,
    description,
    system_type,
    host_or_url,
    department,
    classification,
    phi_types,
    encryption_at_rest,
    encryption_at_rest_method,
    encryption_in_transit,
    encryption_in_transit_protocol,
    access_control_method,
    baa_required,
    retention_years,
    retention_legal_basis,
    retention_notes,
    review_cadence,
    last_reviewed_at,
    next_review_due_at,
    source,
    status,
    notes
  )
)
insert into phi_systems (
  organization_id,
  name,
  description,
  system_type,
  host_or_url,
  department,
  classification,
  phi_types,
  encryption_at_rest,
  encryption_at_rest_method,
  encryption_in_transit,
  encryption_in_transit_protocol,
  access_control_method,
  baa_required,
  retention_years,
  retention_legal_basis,
  retention_notes,
  review_cadence,
  last_reviewed_at,
  next_review_due_at,
  source,
  status,
  notes
)
select
  s.organization_id,
  s.name,
  s.description,
  s.system_type,
  s.host_or_url,
  s.department,
  s.classification,
  s.phi_types,
  s.encryption_at_rest,
  s.encryption_at_rest_method,
  s.encryption_in_transit,
  s.encryption_in_transit_protocol,
  s.access_control_method,
  s.baa_required,
  s.retention_years,
  s.retention_legal_basis,
  s.retention_notes,
  s.review_cadence,
  s.last_reviewed_at,
  s.next_review_due_at,
  s.source,
  s.status,
  s.notes
from seed_rows s
where not exists (
  select 1
  from phi_systems p
  where p.organization_id = s.organization_id
    and p.name = s.name
    and p.source = s.source
);
