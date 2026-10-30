-- Cierre por empresa y lunes el sábado (no el domingo). Distinto de la extensión 7-9.

alter table public.companies
  add column if not exists selection_close_time time not null default time '12:00';

comment on column public.companies.selection_close_time is
  'Hora de cierre de elección el día anterior (Tucumán). El lunes cierra el sábado a esta hora. No es la extensión 7:00-9:00.';

create or replace function private.selection_deadline(p_service_date date, p_company_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (
      case
        when extract(isodow from p_service_date) = 1 then p_service_date - 2
        else p_service_date - 1
      end
    )::timestamp
    + coalesce(
        (select c.selection_close_time from public.companies c where c.id = p_company_id),
        time '12:00'
      )
  ) at time zone 'America/Argentina/Tucuman';
$$;

comment on function private.selection_deadline(date, uuid) is
  'Cierre: hora de la empresa el día anterior; si el servicio es lunes, el sábado.';

create or replace function private.is_within_selection_window(p_service_date date, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.fn_now() < private.selection_deadline(p_service_date, p_company_id)
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

create or replace function public.get_my_menu(p_service_date date, p_company_id uuid default null)
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
         private.selection_deadline(d.service_date, co.id),
         private.is_within_selection_window(d.service_date, co.id),
         exists (select 1
                 from public.employee_selections s
                 join public.employee_selection_items i on i.selection_id = s.id
                 where s.employee_id = (select auth.uid())
                   and s.calendar_day_id = d.id
                   and s.company_id = co.id
                   and s.status = 'SUBMITTED'
                   and i.option_id = o.id)
  from (
    select distinct on (m.company_id)
           m.user_id, m.company_id, m.business_space_id, m.status, m.started_at, m.ended_at
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.role in ('EMPLOYEE', 'COMPANY_ADMIN')
      and (p_company_id is null or m.company_id = p_company_id)
      and private.is_current_membership(m.status, m.started_at, m.ended_at, p_service_date)
    order by m.company_id, case m.role when 'EMPLOYEE' then 0 else 1 end
  ) m
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
  order by co.nombre_comercial, c.sort_order, c.name, a.sort_order, o.sort_order, o.name;
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

    new.locked_at := private.selection_deadline(new.service_date, new.company_id);
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

drop function if exists public.get_selection_deadline(date);

create function public.get_selection_deadline(p_service_date date, p_company_id uuid)
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select private.selection_deadline(p_service_date, p_company_id);
$$;

revoke execute on function public.get_selection_deadline(date, uuid) from public, anon;
grant execute on function public.get_selection_deadline(date, uuid) to authenticated, service_role;
grant execute on function private.selection_deadline(date, uuid) to authenticated, service_role;

drop function if exists private.is_within_selection_window(date);
drop function if exists private.selection_deadline(date);
