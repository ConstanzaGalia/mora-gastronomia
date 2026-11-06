-- Roles reutilizables con pantallas y empresas (SCOPED). Solo lectura acotada.
-- Requiere 20261106140000_scoped_access_roles.sql (ADD VALUE SCOPED) ya aplicada.

create type public.access_view as enum (
  'inicio',
  'comensales',
  'reportes',
  'pedidos_empresa'
);

create table public.access_roles (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete restrict,
  name               text not null check (length(btrim(name)) > 0),
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint access_roles_org_name_key unique (organization_id, name)
);

comment on table public.access_roles is
  'Roles armados por Mora: pantallas y empresas que puede ver una persona SCOPED.';

create table public.access_role_views (
  access_role_id  uuid not null references public.access_roles(id) on delete cascade,
  view_key        public.access_view not null,
  primary key (access_role_id, view_key)
);

create table public.access_role_companies (
  access_role_id  uuid not null references public.access_roles(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete restrict,
  primary key (access_role_id, company_id)
);

create index access_role_companies_company_idx on public.access_role_companies (company_id);

alter table public.memberships
  add column access_role_id uuid references public.access_roles(id) on delete restrict;

alter table public.memberships drop constraint memberships_scope_chk;
alter table public.memberships add constraint memberships_scope_chk check (
     (role = 'ORG_ADMIN' and business_space_id is null and company_id is null and access_role_id is null)
  or (role in ('SPACE_ADMIN', 'KITCHEN') and business_space_id is not null and company_id is null and access_role_id is null)
  or (role in ('COMPANY_ADMIN', 'EMPLOYEE') and business_space_id is not null and company_id is not null and access_role_id is null)
  or (role = 'SCOPED' and business_space_id is not null and company_id is null and access_role_id is not null)
);

create or replace function private.access_role_space(p_access_role_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.business_space_id
  from public.access_role_companies arc
  join public.companies c on c.id = arc.company_id
  where arc.access_role_id = p_access_role_id
  limit 1;
$$;

create or replace function private.trg_access_role_companies_same_space()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_space uuid;
  v_company_space uuid;
  v_company_org uuid;
  v_role_org uuid;
begin
  select r.organization_id into v_role_org
  from public.access_roles r
  where r.id = new.access_role_id;

  select c.business_space_id, s.organization_id
    into v_company_space, v_company_org
  from public.companies c
  join public.business_spaces s on s.id = c.business_space_id
  where c.id = new.company_id;

  if v_company_space is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_NOT_FOUND';
  end if;

  if v_role_org is distinct from v_company_org then
    raise exception using errcode = 'P0001', message = 'COMPANY_ORG_MISMATCH';
  end if;

  select private.access_role_space(new.access_role_id) into v_space;
  if v_space is not null and v_space <> v_company_space then
    raise exception using errcode = 'P0001', message = 'ACCESS_ROLE_ONE_SPACE';
  end if;

  return new;
end;
$$;

create trigger access_role_companies_same_space
  before insert or update on public.access_role_companies
  for each row execute function private.trg_access_role_companies_same_space();

create or replace function private.trg_memberships_scoped_role_space()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_space uuid;
  v_org uuid;
begin
  if new.role <> 'SCOPED' then
    return new;
  end if;
  if new.access_role_id is null then
    raise exception using errcode = 'P0001', message = 'SCOPED_NEEDS_ROLE';
  end if;
  select organization_id into v_org from public.access_roles where id = new.access_role_id;
  if v_org is null or v_org <> new.organization_id then
    raise exception using errcode = 'P0001', message = 'SCOPED_ROLE_ORG_MISMATCH';
  end if;
  v_space := private.access_role_space(new.access_role_id);
  if v_space is null then
    raise exception using errcode = 'P0001', message = 'SCOPED_ROLE_NO_COMPANIES';
  end if;
  if new.business_space_id is distinct from v_space then
    raise exception using errcode = 'P0001', message = 'SCOPED_ROLE_SPACE_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger memberships_scoped_role_space
  before insert or update on public.memberships
  for each row execute function private.trg_memberships_scoped_role_space();

create trigger set_updated_at before update on public.access_roles
  for each row execute function private.set_updated_at();

-- Lectura SCOPED -----------------------------------------------------------

create or replace function private.scoped_membership()
returns public.memberships
language sql stable security definer set search_path = ''
as $$
  select m.*
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.role = 'SCOPED'
    and private.user_is_active()
    and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today())
  order by m.started_at desc
  limit 1;
$$;

create or replace function private.scoped_has_view(p_view public.access_view)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from private.scoped_membership() m
    join public.access_role_views v on v.access_role_id = m.access_role_id
    where v.view_key = p_view
  );
$$;

create or replace function private.scoped_has_any_view(p_views public.access_view[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from private.scoped_membership() m
    join public.access_role_views v on v.access_role_id = m.access_role_id
    where v.view_key = any (p_views)
  );
$$;

create or replace function private.scoped_can_view_company(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from private.scoped_membership() m
    join public.access_role_companies c on c.access_role_id = m.access_role_id
    where c.company_id = p_company_id
  );
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
            where c.id = p_company_id and private.is_kitchen(c.business_space_id))
      or private.scoped_can_view_company(p_company_id);
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
           or private.is_kitchen(s.business_space_id)
           or (private.scoped_can_view_company(s.company_id)
               and private.scoped_has_any_view(array['comensales', 'reportes']::public.access_view[]))));
$$;

create or replace function private.can_view_company_people(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.can_manage_company(p_company_id)
      or private.is_company_admin(p_company_id)
      or (private.scoped_can_view_company(p_company_id)
          and private.scoped_has_any_view(array['comensales', 'reportes']::public.access_view[]));
$$;

create or replace function private.can_view_profile(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.can_manage_profile(p_user_id)
      or exists (
           select 1 from public.memberships m
           where m.user_id = p_user_id
             and m.company_id is not null
             and private.can_view_company_people(m.company_id));
$$;

drop policy if exists employee_selections_select on public.employee_selections;
create policy employee_selections_select on public.employee_selections for select to authenticated
  using (
    employee_id = (select auth.uid())
    or private.can_manage_company(company_id)
    or private.is_kitchen(business_space_id)
    or (private.scoped_can_view_company(company_id)
        and private.scoped_has_any_view(array['comensales', 'reportes']::public.access_view[]))
  );

drop policy if exists company_day_extras_select on public.company_day_extras;
create policy company_day_extras_select on public.company_day_extras
  for select to authenticated
  using (
    private.has_space_access(business_space_id)
    or private.is_company_admin(company_id)
    or private.is_kitchen(business_space_id)
    or (private.scoped_can_view_company(company_id)
        and private.scoped_has_any_view(array['comensales', 'reportes', 'pedidos_empresa']::public.access_view[]))
  );

drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_org_admin(organization_id)
    or (business_space_id is not null and private.is_space_admin(business_space_id))
    or (company_id is not null and private.is_company_admin(company_id))
    or (company_id is not null and private.can_view_company_people(company_id))
  );

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.can_view_profile(id));

drop policy if exists remitos_select on public.remitos;
create policy remitos_select on public.remitos
  for select to authenticated
  using (
    private.has_space_access(business_space_id)
    or private.is_company_admin(company_id)
    or (private.scoped_can_view_company(company_id) and private.scoped_has_view('reportes'))
  );

drop policy if exists remito_items_select on public.remito_items;
create policy remito_items_select on public.remito_items
  for select to authenticated
  using (
    exists (
      select 1 from public.remitos r
      where r.id = remito_id
        and (private.has_space_access(r.business_space_id)
             or private.is_company_admin(r.company_id)
             or (private.scoped_can_view_company(r.company_id) and private.scoped_has_view('reportes')))
    )
  );

create or replace function public.get_or_create_remito(p_company_id uuid, p_service_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space   uuid;
  v_remito  uuid;
  v_folio   bigint;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  select c.business_space_id into v_space
  from public.companies c
  where c.id = p_company_id and c.active;
  if v_space is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_NOT_AVAILABLE';
  end if;

  if not (
    private.has_space_access(v_space)
    or private.is_company_admin(p_company_id)
    or (private.scoped_can_view_company(p_company_id) and private.scoped_has_view('reportes'))
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select r.id into v_remito
  from public.remitos r
  where r.company_id = p_company_id
    and r.service_date = p_service_date;
  if v_remito is not null then
    return v_remito;
  end if;

  select coalesce(max(r.folio), 0) + 1 into v_folio
  from public.remitos r
  where r.business_space_id = v_space
    and r.point_of_sale = '0001';

  insert into public.remitos (
    business_space_id, company_id, service_date, point_of_sale, folio, created_by
  ) values (
    v_space, p_company_id, p_service_date, '0001', v_folio, auth.uid()
  )
  returning id into v_remito;

  insert into public.remito_items (remito_id, category_name, option_name, quantity, sort_order)
  select
    v_remito,
    m.category_name,
    m.option_name,
    m.quantity,
    m.sort_order
  from (
    select
      x.category_name,
      x.option_name,
      sum(x.qty)::integer as quantity,
      min(x.sort_order)::integer as sort_order
    from (
      select
        c.name as category_name,
        o.name as option_name,
        count(*)::integer as qty,
        c.sort_order
      from public.employee_selections s
      join public.employee_selection_items i on i.selection_id = s.id
      join public.gastronomic_categories c on c.id = i.category_id
      join public.gastronomic_options o on o.id = i.option_id
      where s.company_id = p_company_id
        and s.service_date = p_service_date
        and s.status = 'SUBMITTED'
      group by c.name, o.name, c.sort_order
      union all
      select
        c.name,
        o.name,
        e.quantity,
        c.sort_order
      from public.company_day_extras e
      join public.calendar_days d on d.id = e.calendar_day_id
      join public.gastronomic_categories c on c.id = e.category_id
      join public.gastronomic_options o on o.id = e.option_id
      where e.company_id = p_company_id
        and d.service_date = p_service_date
    ) x
    group by x.category_name, x.option_name
  ) m
  where m.quantity > 0
  order by m.sort_order, m.category_name, m.option_name;

  return v_remito;
exception
  when unique_violation then
    select r.id into v_remito
    from public.remitos r
    where r.company_id = p_company_id
      and r.service_date = p_service_date;
    if v_remito is null then
      raise;
    end if;
    return v_remito;
end;
$$;

-- Tablas de roles: RLS -----------------------------------------------------

alter table public.access_roles enable row level security;
alter table public.access_role_views enable row level security;
alter table public.access_role_companies enable row level security;

create policy access_roles_select on public.access_roles for select to authenticated
  using (
    private.is_org_admin(organization_id)
    or exists (
      select 1 from public.memberships m
      where m.user_id = (select auth.uid())
        and m.access_role_id = access_roles.id
        and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today())
    )
  );
create policy access_roles_insert on public.access_roles for insert to authenticated
  with check (private.is_org_admin(organization_id));
create policy access_roles_update on public.access_roles for update to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));
create policy access_roles_delete on public.access_roles for delete to authenticated
  using (private.is_org_admin(organization_id));

create policy access_role_views_select on public.access_role_views for select to authenticated
  using (
    exists (
      select 1 from public.access_roles r
      where r.id = access_role_id
        and (private.is_org_admin(r.organization_id)
             or exists (
               select 1 from public.memberships m
               where m.user_id = (select auth.uid())
                 and m.access_role_id = r.id
                 and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today())
             ))
    )
  );
create policy access_role_views_insert on public.access_role_views for insert to authenticated
  with check (
    exists (select 1 from public.access_roles r where r.id = access_role_id and private.is_org_admin(r.organization_id))
  );
create policy access_role_views_delete on public.access_role_views for delete to authenticated
  using (
    exists (select 1 from public.access_roles r where r.id = access_role_id and private.is_org_admin(r.organization_id))
  );

create policy access_role_companies_select on public.access_role_companies for select to authenticated
  using (
    exists (
      select 1 from public.access_roles r
      where r.id = access_role_id
        and (private.is_org_admin(r.organization_id)
             or exists (
               select 1 from public.memberships m
               where m.user_id = (select auth.uid())
                 and m.access_role_id = r.id
                 and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today())
             ))
    )
  );
create policy access_role_companies_insert on public.access_role_companies for insert to authenticated
  with check (
    exists (select 1 from public.access_roles r where r.id = access_role_id and private.is_org_admin(r.organization_id))
  );
create policy access_role_companies_delete on public.access_role_companies for delete to authenticated
  using (
    exists (select 1 from public.access_roles r where r.id = access_role_id and private.is_org_admin(r.organization_id))
  );

grant select, insert, update, delete on public.access_roles to authenticated, service_role;
grant select, insert, delete on public.access_role_views to authenticated, service_role;
grant select, insert, delete on public.access_role_companies to authenticated, service_role;

-- RPC: alcance del usuario actual -----------------------------------------

drop function if exists public.get_my_roles();
create function public.get_my_roles()
returns table (
  membership_id uuid, role public.app_role, organization_id uuid,
  business_space_id uuid, company_id uuid, access_role_id uuid,
  started_at date, ended_at date)
language sql stable security invoker set search_path = ''
as $$
  select m.id, m.role, m.organization_id, m.business_space_id, m.company_id, m.access_role_id,
         m.started_at, m.ended_at
  from public.memberships m
  where m.user_id = (select auth.uid())
    and private.user_is_active()
    and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today())
  order by m.role, m.started_at;
$$;

create or replace function public.get_my_access_scope()
returns table (
  access_role_id uuid,
  access_role_name text,
  view_key public.access_view,
  company_id uuid
)
language sql stable security invoker set search_path = ''
as $$
  select
    r.id,
    r.name,
    v.view_key,
    c.company_id
  from public.memberships m
  join public.access_roles r on r.id = m.access_role_id and r.active
  left join public.access_role_views v on v.access_role_id = r.id
  left join public.access_role_companies c on c.access_role_id = r.id
  where m.user_id = (select auth.uid())
    and m.role = 'SCOPED'
    and private.user_is_active()
    and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today());
$$;

revoke execute on function public.get_my_roles() from public, anon;
grant execute on function public.get_my_roles() to authenticated, service_role;

revoke execute on function public.get_my_access_scope() from public, anon;
grant execute on function public.get_my_access_scope() to authenticated, service_role;

grant execute on function private.access_role_space(uuid) to authenticated, service_role;
grant execute on function private.scoped_membership() to authenticated, service_role;
grant execute on function private.scoped_has_view(public.access_view) to authenticated, service_role;
grant execute on function private.scoped_has_any_view(public.access_view[]) to authenticated, service_role;
grant execute on function private.scoped_can_view_company(uuid) to authenticated, service_role;
grant execute on function private.can_view_company_people(uuid) to authenticated, service_role;
grant execute on function private.can_view_profile(uuid) to authenticated, service_role;
