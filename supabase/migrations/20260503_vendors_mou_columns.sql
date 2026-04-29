alter table if exists vendors
  add column if not exists mou_document_path text,
  add column if not exists mou_uploaded_at timestamptz;
