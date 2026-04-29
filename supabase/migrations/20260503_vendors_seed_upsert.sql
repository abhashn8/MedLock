do $$
declare
  org_id uuid;
begin
  select id
  into org_id
  from organizations
  order by created_at asc
  limit 1;

  if org_id is null then
    raise notice 'Skipping vendor upsert migration: no organization rows found.';
    return;
  end if;

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
    (org_id, 'Billing Partner', 'PASS', current_date - 220, current_date + 320, 'Claims processing', 81),
    (org_id, 'Supabase', 'WARNING', date '2025-11-01', date '2026-11-01', 'PostgreSQL database hosting, authentication, real-time subscriptions, and file storage containing PHI', 74),
    (org_id, 'Render', 'FAIL', null, null, 'Application server hosting and deployment pipeline for services that process PHI', 41),
    (org_id, 'Anthropic', 'WARNING', date '2026-01-15', date '2027-01-15', 'Claude AI API for PHI leakage detection, compliance report generation, and breach notification drafting', 68),
    (org_id, 'Resend', 'FAIL', null, null, 'Transactional email delivery for breach notification letters and compliance alerts containing PHI', 38),
    (org_id, 'Datadog', 'PASS', date '2025-08-10', date '2027-08-10', 'Application performance monitoring, log aggregation, and SIEM integration for PHI access audit trails', 85),
    (org_id, 'Cloudflare', 'PASS', date '2025-06-18', date '2027-06-18', 'DDoS protection, WAF, TLS termination, and CDN for PHI-bearing application traffic', 91)
  on conflict (organization_id, name) do update
    set baa_status = excluded.baa_status,
        baa_signed_at = excluded.baa_signed_at,
        baa_expires_at = excluded.baa_expires_at,
        covered_services = excluded.covered_services,
        risk_score = excluded.risk_score,
        updated_at = now();
end $$;
