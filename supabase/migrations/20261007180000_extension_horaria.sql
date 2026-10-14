-- Extensión horaria por día y empresa, y extras que carga el encargado.

create table public.day_company_extensions (
  calendar_day_id    uuid not null,
  company_id         uuid not null,
  business_space_id  uuid not null,
  created_at         timestamptz not null default now(),
  constraint day_company_extensions_pkey primary key (calendar_day_id, company_id),
  constraint day_company_extensions_day_space_fkey
    foreign key (calendar_day_id, business_space_id)
    references public.calendar_days(id, business_space_id) on delete restrict,
  constraint day_company_extensions_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict
);
comment on table public.day_company_extensions is
  'Empresas que, ese día, pueden elegir de 7:00 a 9:00 además del cierre de las 12:00 del día anterior.';

create table public.company_day_extras (
  id                 uuid primary key default gen_random_uuid(),
  calendar_day_id    uuid not null,
  company_id         uuid not null,
  business_space_id  uuid not null,
  category_id        uuid not null,
  option_id          uuid not null,
  quantity           integer not null check (quantity > 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint company_day_extras_day_company_option_key unique (calendar_day_id, company_id, option_id),
  constraint company_day_extras_day_space_fkey
    foreign key (calendar_day_id, business_space_id)
    references public.calendar_days(id, business_space_id) on delete restrict,
  constraint company_day_extras_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict,
  constraint company_day_extras_category_space_fkey
    foreign key (category_id, business_space_id)
    references public.gastronomic_categories(id, business_space_id) on delete restrict,
  constraint company_day_extras_option_fkey
    foreign key (option_id, category_id)
    references public.gastronomic_options(id, category_id) on delete restrict
);
comment on table public.company_day_extras is
  'Cantidades extra que suma el encargado, aparte de lo que eligió cada persona.';

create index company_day_extras_day_idx on public.company_day_extras (calendar_day_id);
create index day_company_extensions_company_idx on public.day_company_extensions (company_id);

create trigger set_updated_at before update on public.company_day_extras
  for each row execute function private.set_updated_at();

-- Ventana normal, o de 7:00 a 9:00 del mismo día si la empresa está marcada.
create or replace function private.is_within_selection_window(p_service_date date, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.fn_now() < private.selection_deadline(p_service_date)
      or (
        private.fn_now() >= (p_service_date::timestamp + time '07:00') at time zone 'America/Argentina/Tucuman'
        and private.fn_now() < (p_service_date::timestamp + time '09:00') at time zone 'America/Argentina/Tucuman'
        and exists (
          select 1
          from public.day_company_extensions e
          join public.calendar_days d on d.id = e.calendar_day_id and d.business_space_id = e.business_space_id
          where e.company_id = p_company_id
            and d.service_date = p_service_date
        )
      );
$$;

create or replace function private.trg_employee_selections_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now            timestamptz := private.fn_now();
  v_service_date   date;
  v_space          uuid;
  v_is_service_day boolean;
  v_week_status    public.calendar_week_status;
  v_membership     uuid;
begin
  if tg_op = 'INSERT' then
    select d.service_date, d.business_space_id, d.is_service_day, w.status
      into v_service_date, v_space, v_is_service_day, v_week_status
    from public.calendar_days d
    join public.calendar_weeks w on w.id = d.calendar_week_id
    where d.id = new.calendar_day_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'CALENDAR_DAY_NOT_FOUND';
    end if;
    if v_week_status <> 'PUBLISHED' then
      raise exception using errcode = 'P0001', message = 'WEEK_NOT_PUBLISHED';
    end if;
    if not v_is_service_day then
      raise exception using errcode = 'P0001', message = 'NOT_A_SERVICE_DAY';
    end if;

    new.service_date      := v_service_date;
    new.business_space_id := v_space;

    if not exists (select 1 from public.companies c
                   where c.id = new.company_id and c.business_space_id = v_space and c.active) then
      raise exception using errcode = 'P0001', message = 'COMPANY_NOT_AVAILABLE';
    end if;

    v_membership := private.employee_membership_on(new.employee_id, new.company_id, new.service_date);
    if v_membership is null then
      raise exception using errcode = 'P0001', message = 'NO_ACTIVE_MEMBERSHIP',
        detail = 'El empleado no pertenece a esa empresa en la fecha del servicio.';
    end if;
    new.membership_id := v_membership;

    new.locked_at := private.selection_deadline(new.service_date);
    if not private.is_within_selection_window(new.service_date, new.company_id) then
      raise exception using errcode = 'P0001', message = 'SELECTION_WINDOW_CLOSED',
        detail = 'El plazo para elegir ya cerró.';
    end if;

    new.status       := 'SUBMITTED';
    new.submitted_at := v_now;
    new.cancelled_at := null;
    return new;
  end if;

  if new.employee_id <> old.employee_id
     or new.company_id <> old.company_id
     or new.calendar_day_id <> old.calendar_day_id
     or new.service_date <> old.service_date
     or new.business_space_id <> old.business_space_id
     or new.membership_id <> old.membership_id
     or new.locked_at <> old.locked_at then
    raise exception using errcode = 'P0001', message = 'IMMUTABLE_FIELDS';
  end if;
  if not private.is_within_selection_window(old.service_date, old.company_id) then
    raise exception using errcode = 'P0001', message = 'SELECTION_LOCKED',
      detail = 'La elección ya está cerrada y no puede modificarse.';
  end if;
  if old.status = 'CANCELLED' then
    raise exception using errcode = 'P0001', message = 'SELECTION_CANCELLED';
  end if;

  if new.status = 'CANCELLED' then
    new.cancelled_at := v_now;
  else
    new.submitted_at := v_now;
  end if;
  return new;
end;
$$;

create or replace function private.trg_selection_items_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection_id uuid;
  v_status       public.selection_status;
  v_company_id   uuid;
  v_day_id       uuid;
  v_service_date date;
  v_opt_active   boolean;
  v_cat_active   boolean;
begin
  if tg_op = 'DELETE' then
    v_selection_id := old.selection_id;
  else
    v_selection_id := new.selection_id;
  end if;

  select s.status, s.company_id, s.calendar_day_id, s.service_date
    into v_status, v_company_id, v_day_id, v_service_date
  from public.employee_selections s where s.id = v_selection_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'SELECTION_NOT_FOUND';
  end if;
  if v_status <> 'SUBMITTED' then
    raise exception using errcode = 'P0001', message = 'SELECTION_CANCELLED';
  end if;
  if not private.is_within_selection_window(v_service_date, v_company_id) then
    raise exception using errcode = 'P0001', message = 'SELECTION_LOCKED',
      detail = 'La elección ya está cerrada y no puede modificarse.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' and new.selection_id <> old.selection_id then
    raise exception using errcode = 'P0001', message = 'IMMUTABLE_FIELDS';
  end if;

  if not private.is_category_enabled_for_company(v_company_id, new.category_id) then
    raise exception using errcode = 'P0001', message = 'CATEGORY_NOT_ENABLED',
      detail = 'La categoría no está habilitada para la empresa.';
  end if;

  select o.active, c.active into v_opt_active, v_cat_active
  from public.gastronomic_options o
  join public.gastronomic_categories c on c.id = o.category_id
  where o.id = new.option_id and o.category_id = new.category_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'OPTION_CATEGORY_MISMATCH';
  end if;
  if not (v_opt_active and v_cat_active) then
    raise exception using errcode = 'P0001', message = 'OPTION_INACTIVE';
  end if;
  if not private.is_option_available(v_day_id, new.option_id) then
    raise exception using errcode = 'P0001', message = 'OPTION_NOT_AVAILABLE',
      detail = 'La opción no está disponible para ese día.';
  end if;
  return new;
end;
$$;

create or replace function private.trg_company_day_extras_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id   uuid;
  v_day_id       uuid;
  v_space        uuid;
  v_service_date date;
  v_service      boolean;
  v_published    boolean;
begin
  if tg_op = 'DELETE' then
    v_company_id := old.company_id;
    v_day_id := old.calendar_day_id;
    v_space := old.business_space_id;
  else
    v_company_id := new.company_id;
    v_day_id := new.calendar_day_id;
    v_space := new.business_space_id;
  end if;

  select d.service_date, d.is_service_day, w.status = 'PUBLISHED'
    into v_service_date, v_service, v_published
  from public.calendar_days d
  join public.calendar_weeks w on w.id = d.calendar_week_id
  where d.id = v_day_id and d.business_space_id = v_space;

  if not found or not v_service or not v_published then
    raise exception using errcode = 'P0001', message = 'CALENDAR_DAY_NOT_FOUND';
  end if;
  if not private.is_within_selection_window(v_service_date, v_company_id)
     and not private.has_space_access(v_space) then
    raise exception using errcode = 'P0001', message = 'SELECTION_WINDOW_CLOSED',
      detail = 'El plazo para cargar extras ya cerró.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if not private.is_category_enabled_for_company(v_company_id, new.category_id) then
    raise exception using errcode = 'P0001', message = 'CATEGORY_NOT_ENABLED',
      detail = 'La categoría no está habilitada para la empresa.';
  end if;
  if not private.is_option_available(v_day_id, new.option_id) then
    raise exception using errcode = 'P0001', message = 'OPTION_NOT_AVAILABLE',
      detail = 'La opción no está disponible para ese día.';
  end if;
  return new;
end;
$$;

create trigger company_day_extras_validate
  before insert or update or delete on public.company_day_extras
  for each row execute function private.trg_company_day_extras_validate();

alter table public.day_company_extensions enable row level security;
alter table public.company_day_extras enable row level security;

create policy day_company_extensions_select on public.day_company_extensions
  for select to authenticated
  using (private.has_space_access(business_space_id) or private.is_company_admin(company_id));
create policy day_company_extensions_insert on public.day_company_extensions
  for insert to authenticated
  with check (private.has_space_access(business_space_id));
create policy day_company_extensions_delete on public.day_company_extensions
  for delete to authenticated
  using (private.has_space_access(business_space_id));

create policy company_day_extras_select on public.company_day_extras
  for select to authenticated
  using (private.has_space_access(business_space_id) or private.is_company_admin(company_id));
create policy company_day_extras_insert on public.company_day_extras
  for insert to authenticated
  with check (private.is_company_admin(company_id));
create policy company_day_extras_update on public.company_day_extras
  for update to authenticated
  using (private.is_company_admin(company_id))
  with check (private.is_company_admin(company_id));
create policy company_day_extras_delete on public.company_day_extras
  for delete to authenticated
  using (private.is_company_admin(company_id) or private.has_space_access(business_space_id));

grant select, insert, delete on public.day_company_extensions to authenticated, service_role;
grant select, insert, update, delete on public.company_day_extras to authenticated, service_role;

create or replace function public.get_my_menu(p_service_date date)
returns table (
  calendar_day_id uuid, service_date date, company_id uuid, company_name text,
  category_id uuid, category_name text, category_sort_order integer,
  option_id uuid, option_name text, option_sort_order integer,
  deadline timestamptz, window_open boolean, is_selected boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.service_date, co.id, co.nombre_comercial,
         c.id, c.name, c.sort_order,
         o.id, o.name, o.sort_order,
         private.selection_deadline(d.service_date),
         private.is_within_selection_window(d.service_date, co.id),
         exists (select 1
                 from public.employee_selections s
                 join public.employee_selection_items i on i.selection_id = s.id
                 where s.employee_id = (select auth.uid())
                   and s.calendar_day_id = d.id
                   and s.status = 'SUBMITTED'
                   and i.option_id = o.id)
  from public.memberships m
  join public.profiles p on p.id = m.user_id and p.activo
  join public.companies co on co.id = m.company_id and co.active
  join public.calendar_days d
    on d.business_space_id = m.business_space_id
   and d.service_date = p_service_date
   and d.is_service_day
  join public.calendar_weeks w on w.id = d.calendar_week_id and w.status = 'PUBLISHED'
  join public.daily_availability a on a.calendar_day_id = d.id
  join public.gastronomic_categories c on c.id = a.category_id and c.active
  join public.company_gastronomic_categories cgc
    on cgc.company_id = co.id and cgc.category_id = c.id and cgc.active
  join public.gastronomic_options o on o.id = a.option_id and o.active
  where m.user_id = (select auth.uid())
    and m.role = 'EMPLOYEE'
    and private.is_current_membership(m.status, m.started_at, m.ended_at, p_service_date)
  order by c.sort_order, c.name, a.sort_order, o.sort_order, o.name;
$$;

create or replace function public.selection_window_open(p_calendar_day_id uuid, p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  if not private.can_manage_company(p_company_id) then
    return false;
  end if;
  select d.service_date into v_date
  from public.calendar_days d
  join public.companies c on c.id = p_company_id and c.business_space_id = d.business_space_id
  where d.id = p_calendar_day_id;
  if v_date is null then
    return false;
  end if;
  return private.is_within_selection_window(v_date, p_company_id);
end;
$$;

create or replace function public.save_employee_choice(p_membership_id uuid, p_calendar_day_id uuid, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid;
  v_company    uuid;
  v_selection  uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_SELECTION',
      detail = 'Elegí al menos una opción.';
  end if;

  select m.user_id, m.company_id into v_user, v_company
  from public.memberships m
  where m.id = p_membership_id and m.role = 'EMPLOYEE';
  if v_user is null or not private.is_company_admin(v_company) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if exists (
    select 1 from public.employee_selections s
    where s.employee_id = v_user and s.calendar_day_id = p_calendar_day_id and s.status = 'SUBMITTED'
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_CHOSEN',
      detail = 'Esa persona ya eligió. No se puede reemplazar.';
  end if;

  insert into public.employee_selections (employee_id, company_id, calendar_day_id)
  values (v_user, v_company, p_calendar_day_id)
  returning id into v_selection;

  insert into public.employee_selection_items (selection_id, category_id, option_id)
  select v_selection, (e ->> 'category_id')::uuid, (e ->> 'option_id')::uuid
  from jsonb_array_elements(p_items) e;

  return v_selection;
end;
$$;

create or replace function public.save_company_extras(p_calendar_day_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_space   uuid;
  v_date    date;
  v_service boolean;
begin
  select m.company_id, m.business_space_id into v_company, v_space
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.role = 'COMPANY_ADMIN'
    and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today())
  limit 1;
  if v_company is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select d.service_date, d.is_service_day into v_date, v_service
  from public.calendar_days d
  where d.id = p_calendar_day_id and d.business_space_id = v_space;
  if v_date is null or not v_service then
    raise exception using errcode = 'P0001', message = 'CALENDAR_DAY_NOT_FOUND';
  end if;
  if not private.is_within_selection_window(v_date, v_company) then
    raise exception using errcode = 'P0001', message = 'SELECTION_WINDOW_CLOSED',
      detail = 'El plazo para cargar extras ya cerró.';
  end if;

  delete from public.company_day_extras
  where calendar_day_id = p_calendar_day_id and company_id = v_company;

  insert into public.company_day_extras (
    calendar_day_id, company_id, business_space_id, category_id, option_id, quantity
  )
  select p_calendar_day_id, v_company, v_space,
         (e ->> 'category_id')::uuid,
         (e ->> 'option_id')::uuid,
         (e ->> 'quantity')::integer
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
  where coalesce((e ->> 'quantity')::integer, 0) > 0;
end;
$$;

create or replace function public.extra_tray_days_until(p_space_id uuid, p_until date)
returns table (company_id uuid, service_date date, trays integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select x.company_id, d.service_date, sum(x.quantity)::integer
  from public.company_day_extras x
  join public.calendar_days d on d.id = x.calendar_day_id and d.business_space_id = x.business_space_id
  join public.gastronomic_categories gc on gc.id = x.category_id
  where x.business_space_id = p_space_id
    and gc.slug = 'bandeja'
    and d.service_date <= p_until
  group by x.company_id, d.service_date
$$;

grant execute on function public.selection_window_open(uuid, uuid) to authenticated, service_role;
grant execute on function public.save_employee_choice(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.save_company_extras(uuid, jsonb) to authenticated, service_role;
grant execute on function public.extra_tray_days_until(uuid, date) to authenticated, service_role;
