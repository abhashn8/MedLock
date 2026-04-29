-- Private bucket for vendor MOU / BAA documents uploaded from the dashboard.
insert into storage.buckets (id, name, public)
values ('vendor-documents', 'vendor-documents', false)
on conflict (id) do nothing;

-- Path convention: {organization_id}/{vendor_id}/mou-...
-- Allow authenticated org members to read/write objects under their org prefix.

drop policy if exists vendor_documents_bucket_select on storage.objects;
create policy vendor_documents_bucket_select on storage.objects
for select to authenticated
using (
  bucket_id = 'vendor-documents'
  and exists (
    select 1
    from organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.organization_id::text = split_part(name, '/', 1)
  )
);

drop policy if exists vendor_documents_bucket_insert on storage.objects;
create policy vendor_documents_bucket_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'vendor-documents'
  and exists (
    select 1
    from organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.organization_id::text = split_part(name, '/', 1)
  )
);

drop policy if exists vendor_documents_bucket_update on storage.objects;
create policy vendor_documents_bucket_update on storage.objects
for update to authenticated
using (
  bucket_id = 'vendor-documents'
  and exists (
    select 1
    from organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.organization_id::text = split_part(name, '/', 1)
  )
)
with check (
  bucket_id = 'vendor-documents'
  and exists (
    select 1
    from organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.organization_id::text = split_part(name, '/', 1)
  )
);

drop policy if exists vendor_documents_bucket_delete on storage.objects;
create policy vendor_documents_bucket_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'vendor-documents'
  and exists (
    select 1
    from organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.organization_id::text = split_part(name, '/', 1)
  )
);
