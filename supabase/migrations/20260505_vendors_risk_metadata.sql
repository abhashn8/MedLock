alter table if exists vendors
  add column if not exists risk_breakdown jsonb,
  add column if not exists risk_model_version text not null default 'v1',
  add column if not exists risk_computed_at timestamptz;
