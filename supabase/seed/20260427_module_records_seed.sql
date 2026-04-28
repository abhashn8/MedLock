-- Seed generic CRUD records for all dashboard modules
-- Requires: 20260427_module_records.sql and core org tables.

do $$
declare
  target_user uuid;
  org_id uuid;
  module_keys text[] := array[
    'compliance-score-trend',
    'phi-leakage-scanner',
    'phi-inventory',
    'de-identification-checker',
    'access-control-settings',
    'role-management',
    'user-access-review',
    'emergency-access-log',
    'encryption-inventory',
    'audit-log-viewer',
    'anomaly-alerts',
    'network-transmission-security',
    'risk-assessment',
    'findings-remediation',
    'policy-library',
    'controls-checklist',
    'baa-tracker',
    'vendor-risk-scores',
    'subcontractor-register',
    'training-tracker',
    'training-course-library',
    'policy-acknowledgements',
    'sanctions-log',
    'incident-intake',
    'active-incidents',
    'breach-notification-center',
    'incident-history',
    'report-generator',
    'scheduled-reports',
    'audit-packages',
    'previous-reports-archive',
    'organization-profile',
    'integrations',
    'notification-preferences',
    'user-management',
    'billing-plan'
  ];
  module_key text;
begin
  select id into target_user from auth.users order by created_at asc limit 1;
  if target_user is null then
    raise exception 'No users found in auth.users';
  end if;

  select organization_id into org_id
  from organization_memberships
  where user_id = target_user
  order by created_at asc
  limit 1;

  if org_id is null then
    raise exception 'No organization membership found for user %', target_user;
  end if;

  foreach module_key in array module_keys loop
    insert into feature_records (
      organization_id,
      module_key,
      title,
      description,
      status,
      severity,
      due_at,
      data,
      created_by
    ) values (
      org_id,
      module_key,
      initcap(replace(module_key, '-', ' ')) || ' mock record',
      'Mock persisted record for CRUD testing on ' || module_key,
      'PENDING',
      case
        when module_key in ('anomaly-alerts', 'findings-remediation', 'breach-notification-center') then 'HIGH'::hs_severity
        when module_key in ('phi-leakage-scanner', 'active-incidents') then 'CRITICAL'::hs_severity
        else 'MEDIUM'::hs_severity
      end,
      now() + interval '14 days',
      jsonb_build_object(
        'owner', 'Compliance Manager',
        'source', module_key,
        'badgeHint',
        case
          when module_key = 'phi-leakage-scanner' then 3
          when module_key = 'user-access-review' then 12
          when module_key = 'findings-remediation' then 8
          when module_key = 'baa-tracker' then 2
          when module_key = 'training-tracker' then 5
          else 0
        end
      ),
      target_user
    );
  end loop;
end $$;
