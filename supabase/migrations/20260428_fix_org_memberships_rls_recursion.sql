-- Fix RLS recursion on organization_memberships.
-- Prior policy referenced organization_memberships inside itself.

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_org_admin(uuid) from public; 
grant execute on function public.is_org_admin(uuid) to authenticated;

drop policy if exists org_memberships_select on organization_memberships;
create policy org_memberships_select on organization_memberships
for select using (
  user_id = auth.uid()
  or public.is_org_admin(organization_id)
);
