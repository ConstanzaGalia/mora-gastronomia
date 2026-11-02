-- Alcance y lectura del rol KITCHEN. No entra en has_space_access ni is_any_admin.

alter table public.memberships drop constraint memberships_scope_chk;
alter table public.memberships add constraint memberships_scope_chk check (
     (role = 'ORG_ADMIN' and business_space_id is null and company_id is null)
  or (role in ('SPACE_ADMIN', 'KITCHEN') and business_space_id is not null and company_id is null)
  or (role in ('COMPANY_ADMIN', 'EMPLOYEE') and business_space_id is not null and company_id is not null)
);

create or replace function private.is_kitchen(p_business_space_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_is_active() and exists (
    select 1 from public.memberships m
    join public.business_spaces s on s.id = m.business_space_id and s.active
    where m.user_id = (select auth.uid())
      and m.role = 'KITCHEN'
      and m.business_space_id = p_business_space_id
      and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today()));
$$;

create or replace function private.can_view_company(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.can_manage_company(p_company_id)
      or (private.user_is_active() and exists (
            select 1 from public.memberships m
            where m.user_id = (select auth.uid()) and m.company_id = p_company_id))
      or exists (
            select 1 from public.companies c
            where c.id = p_company_id and private.is_kitchen(c.business_space_id));
$$;

create or replace function private.can_view_selection(p_selection_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.employee_selections s
    where s.id = p_selection_id
      and (s.employee_id = (select auth.uid())
           or private.can_manage_company(s.company_id)
           or private.is_kitchen(s.business_space_id)));
$$;

drop policy if exists employee_selections_select on public.employee_selections;
create policy employee_selections_select on public.employee_selections for select to authenticated
  using (
    employee_id = (select auth.uid())
    or private.can_manage_company(company_id)
    or private.is_kitchen(business_space_id)
  );

drop policy if exists company_day_extras_select on public.company_day_extras;
create policy company_day_extras_select on public.company_day_extras
  for select to authenticated
  using (
    private.has_space_access(business_space_id)
    or private.is_company_admin(company_id)
    or private.is_kitchen(business_space_id)
  );

drop policy if exists market_settings_select on public.market_settings;
create policy market_settings_select on public.market_settings
  for select to authenticated
  using (private.has_space_access(business_space_id) or private.is_kitchen(business_space_id));

drop policy if exists market_orders_select on public.market_orders;
create policy market_orders_select on public.market_orders
  for select to authenticated
  using (private.has_space_access(business_space_id) or private.is_kitchen(business_space_id));

drop policy if exists market_order_items_select on public.market_order_items;
create policy market_order_items_select on public.market_order_items
  for select to authenticated
  using (private.has_space_access(business_space_id) or private.is_kitchen(business_space_id));

drop policy if exists market_days_select on public.market_days;
create policy market_days_select on public.market_days
  for select to authenticated
  using (private.has_space_access(business_space_id) or private.is_kitchen(business_space_id));
