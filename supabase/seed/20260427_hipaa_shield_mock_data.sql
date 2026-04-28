-- HIPAA Shield demo seed data
-- Prerequisite: run core migration first.
-- This script seeds realistic mock data across all feature modules.

create extension if not exists pgcrypto;

do $$
declare
  target_user uuid;
  org_id uuid;
  policy_privacy uuid;
  policy_security uuid;
  policy_breach uuid;
  policy_privacy_v uuid;
  policy_security_v uuid;
  policy_breach_v uuid;
  role_privacy uuid;
  role_dev uuid;
  role_sec uuid;
  role_compliance uuid;
  course_privacy uuid;
  course_security uuid;
  course_breach uuid;
  campaign_id uuid;
  vendor1 uuid;
  vendor2 uuid;
  vendor3 uuid;
  finding1 uuid;
  finding2 uuid;
  finding3 uuid;
  incident1 uuid;
  incident2 uuid;
  report1 uuid;
  report2 uuid;
begin
  select id into target_user from auth.users order by created_at asc limit 1;

  if target_user is null then
    raise exception 'No users found in auth.users. Create a user first.';
  end if;

  select id into org_id
  from organizations
  where name = 'HIPAA Shield Demo Org'
  limit 1;

  if org_id is null then
    insert into organizations (
      name,
      logo_url,
      contact_email,
      timezone,
      hipaa_reference
    )
    values (
      'HIPAA Shield Demo Org',
      'https://example.com/logo.png',
      'compliance@hipaashield-demo.org',
      'America/New_York',
      '45 CFR Parts 160 & 164'
    )
    returning id into org_id;
  end if;

  insert into organization_memberships (organization_id, user_id, role)
  values (org_id, target_user, 'owner')
  on conflict (organization_id, user_id) do update
    set role = excluded.role;

  insert into user_profiles (user_id, full_name, role_title, department)
  values (
    target_user,
    coalesce((select full_name from user_profiles where user_id = target_user), 'Alex Carter'),
    'Compliance Manager',
    'Compliance'
  )
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        role_title = excluded.role_title,
        department = excluded.department;

  -- GitHub + scans used by existing scanner flow
  insert into github_connections (
    user_id,
    github_access_token,
    github_username
  )
  values (
    target_user,
    'demo_token_replace_me',
    'hipaa-demo-user'
  )
  on conflict (user_id) do update
    set github_access_token = excluded.github_access_token,
        github_username = excluded.github_username,
        updated_at = now();

  insert into scans (user_id, repo_owner, repo_name, findings, created_at)
  values
    (
      target_user,
      'hospital-eng',
      'patient-api',
      '[
        {"filePath":"src/logging/audit.ts","line":42,"lineContent":"logger.info({ patientName, dob })","phiField":"patientName","sink":"logger.info","severity":"HIGH"},
        {"filePath":"src/handlers/claims.ts","line":128,"lineContent":"Sentry.captureMessage(JSON.stringify(claimData))","phiField":"insuranceId","sink":"Sentry.captureMessage","severity":"CRITICAL"}
      ]'::jsonb,
      now() - interval '4 days'
    ),
    (
      target_user,
      'hospital-eng',
      'billing-worker',
      '[
        {"filePath":"src/jobs/export.ts","line":87,"lineContent":"analytics.track(''claim_uploaded'', payload)","phiField":"ssn","sink":"analytics.track","severity":"CRITICAL"}
      ]'::jsonb,
      now() - interval '2 days'
    ),
    (
      target_user,
      'hospital-eng',
      'scheduler',
      '[]'::jsonb,
      now() - interval '1 day'
    );

  insert into scan_schedules (
    organization_id,
    source_type,
    source_ref,
    cron_expr,
    enabled,
    created_by
  )
  values
    (org_id, 'github_repo', 'hospital-eng/patient-api', '0 4 * * *', true, target_user),
    (org_id, 'database', 'prod_claims_db', '0 1 * * 1', true, target_user),
    (org_id, 's3', 's3://hipaa-exports', '0 */6 * * *', false, target_user);

  insert into phi_inventory_assets (
    organization_id,
    system_name,
    data_types,
    classification,
    owner_user_id,
    retention_policy
  )
  values
    (org_id, 'EHR Warehouse', array['MRN','Diagnosis','DOB'], 'Clinical PHI', target_user, '7 years after last encounter'),
    (org_id, 'Billing Platform', array['SSN','Insurance ID','Address'], 'Direct Identifier PHI', target_user, '10 years'),
    (org_id, 'Support Inbox', array['Email','Phone'], 'Contact PHI', target_user, '2 years'),
    (org_id, 'Data Lake Exports', array['DOB','ZIP'], 'Restricted Analytics PHI', target_user, '1 year');

  insert into deidentification_checks (
    organization_id,
    mode,
    result,
    identifiers_found,
    notes,
    created_by
  )
  values
    (org_id, 'SAFE_HARBOR', 'FAIL', array['DOB','ZIP','IP_ADDRESS'], 'Requires DOB year-level truncation and ZIP masking', target_user),
    (org_id, 'SAFE_HARBOR', 'PASS', array[]::text[], 'No direct identifiers detected', target_user),
    (org_id, 'EXPERT_DETERMINATION', 'PENDING', array['QUASI_IDENTIFIER'], 'Awaiting privacy reviewer sign-off', target_user);

  insert into access_policies (organization_id, policy_key, policy_value, created_by)
  values
    (org_id, 'mfa_enforcement', '{"required": true, "scope": "all_users"}'::jsonb, target_user),
    (org_id, 'session_timeout', '{"minutes": 15, "scope": "phi_systems"}'::jsonb, target_user),
    (org_id, 'password_policy', '{"min_length": 14, "rotation_days": 90, "require_symbols": true}'::jsonb, target_user)
  on conflict (organization_id, policy_key) do update
    set policy_value = excluded.policy_value,
        updated_at = now();

  insert into app_roles (organization_id, name, description)
  values
    (org_id, 'Privacy Officer', 'Oversees PHI handling and breach determinations'),
    (org_id, 'Security Engineer', 'Manages technical safeguards and incidents'),
    (org_id, 'Compliance Manager', 'Owns controls, risk, and audit prep'),
    (org_id, 'Developer', 'Remediates technical findings')
  on conflict (organization_id, name) do update
    set description = excluded.description,
        updated_at = now();

  select id into role_privacy from app_roles where organization_id = org_id and name = 'Privacy Officer' limit 1;
  select id into role_sec from app_roles where organization_id = org_id and name = 'Security Engineer' limit 1;
  select id into role_compliance from app_roles where organization_id = org_id and name = 'Compliance Manager' limit 1;
  select id into role_dev from app_roles where organization_id = org_id and name = 'Developer' limit 1;

  insert into app_role_permissions (role_id, permission_key)
  values
    (role_privacy, 'breach.determine'),
    (role_privacy, 'phi.inventory.manage'),
    (role_sec, 'alerts.investigate'),
    (role_sec, 'incident.manage'),
    (role_compliance, 'controls.manage'),
    (role_compliance, 'reports.generate'),
    (role_dev, 'scanner.run'),
    (role_dev, 'finding.remediate')
  on conflict (role_id, permission_key) do nothing;

  insert into user_role_assignments (organization_id, user_id, role_id, assigned_by)
  values
    (org_id, target_user, role_compliance, target_user),
    (org_id, target_user, role_sec, target_user)
  on conflict (organization_id, user_id, role_id) do nothing;

  insert into access_review_campaigns (
    organization_id,
    title,
    status,
    due_at,
    created_by
  )
  values
    (org_id, 'Q2 Access Certification', 'PENDING', now() + interval '12 days', target_user)
  returning id into campaign_id;

  insert into access_review_items (
    campaign_id,
    organization_id,
    user_id,
    system_name,
    manager_user_id,
    decision,
    decision_note
  )
  values
    (campaign_id, org_id, target_user, 'EHR Warehouse', target_user, 'PENDING', null),
    (campaign_id, org_id, target_user, 'Billing Platform', target_user, 'PASS', 'Still required for monthly close'),
    (campaign_id, org_id, target_user, 'Support Inbox', target_user, 'WARNING', 'Scope reduction requested');

  insert into emergency_access_events (
    organization_id,
    actor_user_id,
    target_resource,
    reason,
    reviewed,
    reviewed_by,
    reviewed_at
  )
  values
    (org_id, target_user, 'Patient chart #PT-4821', 'Emergency treatment escalation', true, target_user, now() - interval '3 days'),
    (org_id, target_user, 'Claims export batch #APR-21', 'Critical reconciliation incident', false, null, null);

  insert into findings (
    organization_id,
    source,
    title,
    description,
    severity,
    status,
    owner_user_id,
    due_at,
    metadata
  )
  values
    (
      org_id,
      'scanner',
      'PHI fields logged to analytics',
      'DOB and insurance IDs are included in analytics.track payloads.',
      'CRITICAL',
      'WARNING',
      target_user,
      now() + interval '5 days',
      '{"repo":"hospital-eng/patient-api","scanSource":"github"}'::jsonb
    ),
    (
      org_id,
      'vendor',
      'BAA expiring for Analytics BA',
      'Business Associate Agreement expires in less than 30 days.',
      'HIGH',
      'PENDING',
      target_user,
      now() + interval '18 days',
      '{"vendor":"Analytics BA"}'::jsonb
    ),
    (
      org_id,
      'training',
      'Five workforce HIPAA training assignments overdue',
      'Staff in support operations have overdue annual HIPAA security training.',
      'MEDIUM',
      'PENDING',
      target_user,
      now() + interval '7 days',
      '{"overdueCount":5}'::jsonb
    );

  select id into finding1
  from findings
  where organization_id = org_id
    and title = 'PHI fields logged to analytics'
  order by created_at desc
  limit 1;

  select id into finding2 from findings where organization_id = org_id and title = 'BAA expiring for Analytics BA' limit 1;
  select id into finding3 from findings where organization_id = org_id and title = 'Five workforce HIPAA training assignments overdue' limit 1;

  insert into finding_activities (finding_id, actor_user_id, event_type, note)
  values
    (finding1, target_user, 'created', 'Imported from scanner run'),
    (finding1, target_user, 'owner_assigned', 'Assigned to Security Engineering'),
    (finding2, target_user, 'created', 'Created from BAA tracker expiry alert'),
    (finding3, target_user, 'created', 'Generated from training tracker overdue threshold');

  insert into policies (organization_id, policy_type, title, current_version)
  values
    (org_id, 'privacy', 'HIPAA Privacy Policy', 'v3.1'),
    (org_id, 'security', 'HIPAA Security Policy', 'v2.4'),
    (org_id, 'breach_notification', 'Breach Notification Policy', 'v1.8')
  on conflict (organization_id, title) do update
    set current_version = excluded.current_version,
        updated_at = now();

  select id into policy_privacy from policies where organization_id = org_id and title = 'HIPAA Privacy Policy' limit 1;
  select id into policy_security from policies where organization_id = org_id and title = 'HIPAA Security Policy' limit 1;
  select id into policy_breach from policies where organization_id = org_id and title = 'Breach Notification Policy' limit 1;

  insert into policy_versions (policy_id, version, document_url, published_at, published_by)
  values
    (policy_privacy, 'v3.1', 'https://example.com/policies/privacy-v3-1.pdf', now() - interval '90 days', target_user),
    (policy_security, 'v2.4', 'https://example.com/policies/security-v2-4.pdf', now() - interval '60 days', target_user),
    (policy_breach, 'v1.8', 'https://example.com/policies/breach-v1-8.pdf', now() - interval '45 days', target_user)
  on conflict (policy_id, version) do nothing;

  select id into policy_privacy_v from policy_versions where policy_id = policy_privacy and version = 'v3.1' limit 1;
  select id into policy_security_v from policy_versions where policy_id = policy_security and version = 'v2.4' limit 1;
  select id into policy_breach_v from policy_versions where policy_id = policy_breach and version = 'v1.8' limit 1;

  insert into controls (
    organization_id,
    control_code,
    safeguard_domain,
    title,
    status,
    owner_user_id
  )
  values
    (org_id, '164.308(a)(1)', 'ADMINISTRATIVE', 'Security Management Process', 'PASS', target_user),
    (org_id, '164.310(a)(1)', 'PHYSICAL', 'Facility Access Controls', 'WARNING', target_user),
    (org_id, '164.312(a)(1)', 'TECHNICAL', 'Access Control', 'PASS', target_user),
    (org_id, '164.312(e)(1)', 'TECHNICAL', 'Transmission Security', 'WARNING', target_user)
  on conflict (organization_id, control_code) do update
    set status = excluded.status,
        updated_at = now();

  insert into vendors (
    organization_id,
    name,
    baa_status,
    baa_signed_at,
    baa_expires_at,
    covered_services,
    risk_score
  )
  values
    (org_id, 'Cloud Storage Co', 'PASS', current_date - 300, current_date + 180, 'Encrypted object storage', 88),
    (org_id, 'Analytics BA', 'WARNING', current_date - 360, current_date + 25, 'Event analytics and reporting', 72),
    (org_id, 'Billing Partner', 'PASS', current_date - 220, current_date + 320, 'Claims processing', 81)
  on conflict (organization_id, name) do update
    set baa_status = excluded.baa_status,
        baa_expires_at = excluded.baa_expires_at,
        risk_score = excluded.risk_score,
        updated_at = now();

  select id into vendor1 from vendors where organization_id = org_id and name = 'Cloud Storage Co' limit 1;
  select id into vendor2 from vendors where organization_id = org_id and name = 'Analytics BA' limit 1;
  select id into vendor3 from vendors where organization_id = org_id and name = 'Billing Partner' limit 1;

  insert into vendor_certifications (vendor_id, cert_type, valid_until, evidence_url)
  values
    (vendor1, 'SOC2', current_date + 220, 'https://example.com/vendor/cloud-storage-soc2.pdf'),
    (vendor2, 'HITRUST', current_date + 90, 'https://example.com/vendor/analytics-hitrust.pdf'),
    (vendor3, 'SOC2', current_date + 300, 'https://example.com/vendor/billing-soc2.pdf')
  on conflict do nothing;

  insert into vendor_subcontractors (vendor_id, name, baa_status)
  values
    (vendor2, 'Data Pipeline Sub-BA', 'PENDING'),
    (vendor2, 'Geo Routing Sub-BA', 'PASS'),
    (vendor3, 'Archive Storage Sub-BA', 'PASS')
  on conflict do nothing;

  insert into training_courses (
    organization_id,
    title,
    category,
    duration_minutes,
    active
  )
  values
    (org_id, 'HIPAA Privacy Fundamentals', 'privacy', 35, true),
    (org_id, 'HIPAA Security Awareness', 'security', 30, true),
    (org_id, 'Breach Awareness and Response', 'breach_awareness', 25, true);

  select id into course_privacy
  from training_courses
  where organization_id = org_id and title = 'HIPAA Privacy Fundamentals'
  order by created_at desc
  limit 1;

  select id into course_security from training_courses where organization_id = org_id and title = 'HIPAA Security Awareness' limit 1;
  select id into course_breach from training_courses where organization_id = org_id and title = 'Breach Awareness and Response' limit 1;

  insert into training_assignments (
    organization_id,
    course_id,
    user_id,
    due_at,
    status,
    completed_at
  )
  values
    (org_id, course_privacy, target_user, now() - interval '5 days', 'WARNING', null),
    (org_id, course_security, target_user, now() + interval '14 days', 'PENDING', null),
    (org_id, course_breach, target_user, now() - interval '20 days', 'FAIL', null)
  on conflict (course_id, user_id) do update
    set status = excluded.status,
        due_at = excluded.due_at,
        completed_at = excluded.completed_at,
        updated_at = now();

  insert into policy_acknowledgements (
    organization_id,
    policy_version_id,
    user_id,
    acknowledged_at,
    status
  )
  values
    (org_id, policy_privacy_v, target_user, now() - interval '30 days', 'PASS'),
    (org_id, policy_security_v, target_user, null, 'PENDING'),
    (org_id, policy_breach_v, target_user, null, 'WARNING')
  on conflict (policy_version_id, user_id) do update
    set status = excluded.status,
        acknowledged_at = excluded.acknowledged_at;

  insert into sanctions_log (
    organization_id,
    user_id,
    violation_type,
    action_taken,
    notes
  )
  values
    (org_id, target_user, 'Unauthorized PHI export attempt', 'Written warning and retraining assigned', 'Documented per sanctions policy');

  insert into incidents (
    organization_id,
    title,
    severity,
    status,
    reported_by,
    assigned_to,
    affected_count,
    breach_confirmed
  )
  values
    (org_id, 'Off-hours bulk claims export detected', 'HIGH', 'INVESTIGATING', target_user, target_user, 183, true),
    (org_id, 'Suspicious repeated failed logins', 'MEDIUM', 'TRIAGE', target_user, target_user, null, false);

  select id into incident1
  from incidents
  where organization_id = org_id
    and title = 'Off-hours bulk claims export detected'
  order by created_at desc
  limit 1;

  select id into incident2 from incidents where organization_id = org_id and title = 'Suspicious repeated failed logins' limit 1;

  insert into incident_timeline_events (incident_id, actor_user_id, event_type, details)
  values
    (incident1, target_user, 'intake', 'Incident created from anomaly alert'),
    (incident1, target_user, 'evidence_added', 'Attached SIEM export and user session trace'),
    (incident1, target_user, 'breach_review', 'Privacy review initiated'),
    (incident2, target_user, 'intake', 'Failed login threshold exceeded'),
    (incident2, target_user, 'triage', 'No confirmed PHI access yet');

  insert into breach_notifications (
    incident_id,
    organization_id,
    hhs_due_at,
    hhs_notified_at,
    notification_letter_url
  )
  values
    (
      incident1,
      org_id,
      now() + interval '42 days',
      null,
      'https://example.com/letters/breach-incident-001-draft.pdf'
    )
  on conflict (incident_id) do update
    set hhs_due_at = excluded.hhs_due_at,
        notification_letter_url = excluded.notification_letter_url,
        updated_at = now();

  insert into generated_reports (
    organization_id,
    report_type,
    date_range,
    format,
    generated_by,
    file_url
  )
  values
    (
      org_id,
      'Executive Compliance Summary',
      daterange(current_date - 30, current_date, '[]'),
      'PDF',
      target_user,
      'https://example.com/reports/executive-summary-apr.pdf'
    ),
    (
      org_id,
      'Open Findings Export',
      daterange(current_date - 7, current_date, '[]'),
      'CSV',
      target_user,
      'https://example.com/reports/open-findings-weekly.csv'
    );

  select id into report1
  from generated_reports
  where organization_id = org_id
    and report_type = 'Executive Compliance Summary'
  order by created_at desc
  limit 1;

  select id into report2
  from generated_reports
  where organization_id = org_id
    and report_type = 'Open Findings Export'
  limit 1;

  insert into scheduled_reports (
    organization_id,
    report_type,
    cron_expr,
    recipients,
    enabled,
    created_by
  )
  values
    (org_id, 'Weekly Risk Digest', '0 8 * * 1', array['security@hipaashield-demo.org','compliance@hipaashield-demo.org'], true, target_user),
    (org_id, 'Monthly Training Status', '0 9 1 * *', array['hr@hipaashield-demo.org'], true, target_user);

  insert into audit_packages (
    organization_id,
    package_type,
    status,
    generated_report_id,
    created_by
  )
  values
    (org_id, 'OCR', 'WARNING', report1, target_user),
    (org_id, 'INTERNAL', 'PASS', report2, target_user);

  insert into alert_rules (
    organization_id,
    event_key,
    min_severity,
    recipients,
    channels
  )
  values
    (org_id, 'finding.created', 'HIGH', array['security@hipaashield-demo.org'], array['email','slack']),
    (org_id, 'vendor.baa_expiring', 'MEDIUM', array['privacy@hipaashield-demo.org'], array['email']),
    (org_id, 'training.overdue', 'MEDIUM', array['hr@hipaashield-demo.org'], array['email']);

  insert into integration_connections (
    organization_id,
    integration_key,
    status,
    last_synced_at,
    metadata
  )
  values
    (org_id, 'supabase', 'PASS', now() - interval '8 minutes', '{"region":"us-east-1"}'::jsonb),
    (org_id, 'slack', 'PASS', now() - interval '20 minutes', '{"workspace":"hipaa-shield-demo"}'::jsonb),
    (org_id, 'siem', 'WARNING', now() - interval '2 hours', '{"error":"token expired"}'::jsonb)
  on conflict (organization_id, integration_key) do update
    set status = excluded.status,
        last_synced_at = excluded.last_synced_at,
        metadata = excluded.metadata,
        updated_at = now();

  insert into billing_subscriptions (
    organization_id,
    plan_tier,
    billing_email,
    renewal_at,
    metadata
  )
  values
    (
      org_id,
      'pro',
      'billing@hipaashield-demo.org',
      now() + interval '28 days',
      '{"monthly_scan_quota":200,"used_scans":136}'::jsonb
    )
  on conflict (organization_id) do update
    set plan_tier = excluded.plan_tier,
        billing_email = excluded.billing_email,
        renewal_at = excluded.renewal_at,
        metadata = excluded.metadata,
        updated_at = now();

end $$;
