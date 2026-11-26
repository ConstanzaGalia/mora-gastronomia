-- Turnos de comida (mañana / tarde) por empresa.
-- Switch en companies; la elección guarda meal_shift solo si está activo.

create type public.meal_shift as enum ('MORNING', 'AFTERNOON');

alter table public.companies
  add column if not exists meal_shifts_enabled boolean not null default false;

comment on column public.companies.meal_shifts_enabled is
  'Si true, cada elección de menú debe indicar turno mañana o tarde. No afecta extras ni pedidos grupales.';

alter table public.employee_selections
  add column if not exists meal_shift public.meal_shift;

comment on column public.employee_selections.meal_shift is
  'Turno de comida. Obligatorio si la empresa tiene meal_shifts_enabled; NULL si no.';

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
  v_shifts         boolean;
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

    select c.meal_shifts_enabled into v_shifts
    from public.companies c
    where c.id = new.company_id and c.business_space_id = v_space and c.active;
    if not found then
      raise exception using errcode = 'P0001', message = 'COMPANY_NOT_AVAILABLE';
    end if;

    if coalesce(v_shifts, false) then
      if new.meal_shift is null then
        raise exception using errcode = 'P0001', message = 'MEAL_SHIFT_REQUIRED',
          detail = 'Elegí si vas a comer a la mañana o a la tarde.';
      end if;
    elsif new.meal_shift is not null then
      raise exception using errcode = 'P0001', message = 'MEAL_SHIFT_NOT_ALLOWED',
        detail = 'Esta empresa no separa turnos de comida.';
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

  if old.status = 'CANCELLED' then
    raise exception using errcode = 'P0001', message = 'SELECTION_CANCELLED';
  end if;

  if new.status = 'CANCELLED' then
    if not (
      private.is_within_selection_window(old.service_date, old.company_id)
      or private.company_admin_can_cancel(old.service_date, old.company_id)
      or private.has_space_access(old.business_space_id)
      or exists (
           select 1 from public.memberships m
           where m.id = old.membership_id
             and m.ended_at is not null
             and m.ended_at < old.service_date)
    ) then
      raise exception using errcode = 'P0001', message = 'SELECTION_LOCKED',
        detail = 'La elección ya está cerrada y no puede modificarse.';
    end if;
    new.cancelled_at := v_now;
    return new;
  end if;

  select c.meal_shifts_enabled into v_shifts
  from public.companies c
  where c.id = new.company_id;
  if coalesce(v_shifts, false) then
    if new.meal_shift is null then
      raise exception using errcode = 'P0001', message = 'MEAL_SHIFT_REQUIRED',
        detail = 'Elegí si vas a comer a la mañana o a la tarde.';
    end if;
  elsif new.meal_shift is not null then
    raise exception using errcode = 'P0001', message = 'MEAL_SHIFT_NOT_ALLOWED',
      detail = 'Esta empresa no separa turnos de comida.';
  end if;

  if not private.is_within_selection_window(old.service_date, old.company_id) then
    raise exception using errcode = 'P0001', message = 'SELECTION_LOCKED',
      detail = 'La elección ya está cerrada y no puede modificarse.';
  end if;
  new.submitted_at := v_now;
  return new;
end;
$$;

create or replace view public.v_selection_details
with (security_invoker = true) as
select
  s.id                  as selection_id,
  s.business_space_id,
  s.service_date,
  s.company_id,
  co.nombre_comercial   as company_name,
  s.employee_id,
  p.dni,
  p.nombre,
  p.apellido,
  s.status,
  s.submitted_at,
  s.locked_at,
  (private.fn_now() >= s.locked_at) as is_locked,
  i.category_id,
  c.name                as category_name,
  c.sort_order          as category_sort_order,
  i.option_id,
  o.name                as option_name,
  s.meal_shift
from public.employee_selections s
left join public.companies co                on co.id = s.company_id
left join public.profiles p                  on p.id = s.employee_id
left join public.employee_selection_items i  on i.selection_id = s.id
left join public.gastronomic_categories c    on c.id = i.category_id
left join public.gastronomic_options o       on o.id = i.option_id;

create or replace view public.v_daily_company_shift_option_totals
with (security_invoker = true) as
select
  s.business_space_id,
  s.service_date,
  s.company_id,
  co.nombre_comercial as company_name,
  s.meal_shift,
  i.category_id,
  c.name              as category_name,
  c.sort_order        as category_sort_order,
  i.option_id,
  o.name              as option_name,
  count(*)::integer   as total
from public.employee_selections s
join public.companies co               on co.id = s.company_id
join public.employee_selection_items i on i.selection_id = s.id
join public.gastronomic_categories c   on c.id = i.category_id
join public.gastronomic_options o      on o.id = i.option_id
where s.status = 'SUBMITTED'
group by s.business_space_id, s.service_date, s.company_id, co.nombre_comercial, s.meal_shift,
         i.category_id, c.name, c.sort_order, i.option_id, o.name;

comment on view public.v_daily_company_shift_option_totals is
  'Totales por opción y turno de comida (empresas con meal_shifts_enabled).';

create or replace view public.v_daily_company_shift_totals
with (security_invoker = true) as
select
  s.business_space_id,
  s.service_date,
  s.company_id,
  co.nombre_comercial as company_name,
  s.meal_shift,
  count(*)::integer   as total_viandas
from public.employee_selections s
join public.companies co on co.id = s.company_id
where s.status = 'SUBMITTED'
group by s.business_space_id, s.service_date, s.company_id, co.nombre_comercial, s.meal_shift;

comment on view public.v_daily_company_shift_totals is
  'Viandas por empresa, fecha y turno. Una vianda = una elección SUBMITTED.';

grant select on public.v_daily_company_shift_option_totals to authenticated, service_role;
grant select on public.v_daily_company_shift_totals to authenticated, service_role;

drop function if exists public.get_my_menu(date, uuid);
create or replace function public.get_my_menu(p_service_date date, p_company_id uuid default null)
returns table (
  calendar_day_id uuid, service_date date, company_id uuid, company_name text,
  category_id uuid, category_name text, category_sort_order integer,
  option_id uuid, option_name text, option_sort_order integer,
  deadline timestamptz, window_open boolean, is_selected boolean,
  meal_shifts_enabled boolean, selected_meal_shift public.meal_shift)
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
                   and i.option_id = o.id),
         co.meal_shifts_enabled,
         (select s.meal_shift
          from public.employee_selections s
          where s.employee_id = (select auth.uid())
            and s.calendar_day_id = d.id
            and s.company_id = co.id
            and s.status = 'SUBMITTED'
          limit 1)
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

revoke execute on function public.get_my_menu(date, uuid) from public, anon;
grant execute on function public.get_my_menu(date, uuid) to authenticated;

drop function if exists public.save_my_selection(uuid, jsonb, uuid);
create or replace function public.save_my_selection(
  p_calendar_day_id uuid,
  p_items jsonb,
  p_company_id uuid default null,
  p_meal_shift public.meal_shift default null)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_company    uuid := p_company_id;
  v_date       date;
  v_space      uuid;
  v_selection  uuid;
  v_current    uuid;
  v_categories uuid[];
  v_count      integer;
  v_shifts     boolean;
  v_shift      public.meal_shift := p_meal_shift;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_SELECTION',
      detail = 'Para anular la elección usar cancel_my_selection().';
  end if;

  select d.service_date, d.business_space_id into v_date, v_space
  from public.calendar_days d where d.id = p_calendar_day_id;
  if v_date is null then
    raise exception using errcode = 'P0001', message = 'CALENDAR_DAY_NOT_FOUND';
  end if;

  if v_company is null then
    select count(distinct m.company_id), (array_agg(m.company_id))[1] into v_count, v_company
    from public.memberships m
    where m.user_id = v_uid
      and m.business_space_id = v_space
      and m.role in ('EMPLOYEE', 'COMPANY_ADMIN')
      and private.is_current_membership(m.status, m.started_at, m.ended_at, v_date);
    if v_count > 1 then
      raise exception using errcode = 'P0001', message = 'COMPANY_REQUIRED',
        detail = 'Elegí para qué empresa es el pedido.';
    end if;
  end if;
  if v_company is null or private.employee_membership_on(v_uid, v_company, v_date) is null then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_MEMBERSHIP';
  end if;

  select c.meal_shifts_enabled into v_shifts from public.companies c where c.id = v_company;
  if coalesce(v_shifts, false) then
    if v_shift is null then
      raise exception using errcode = 'P0001', message = 'MEAL_SHIFT_REQUIRED',
        detail = 'Elegí si vas a comer a la mañana o a la tarde.';
    end if;
  else
    v_shift := null;
  end if;

  select s.id, s.company_id into v_selection, v_current
  from public.employee_selections s
  where s.employee_id = v_uid and s.calendar_day_id = p_calendar_day_id and s.status = 'SUBMITTED'
  for update;

  if v_selection is not null and v_current <> v_company then
    update public.employee_selections
       set company_id = v_company,
           meal_shift = v_shift,
           submitted_at = private.fn_now()
     where id = v_selection;
  elsif v_selection is null then
    insert into public.employee_selections (employee_id, company_id, calendar_day_id, meal_shift)
    values (v_uid, v_company, p_calendar_day_id, v_shift)
    returning id into v_selection;
  else
    update public.employee_selections
       set submitted_at = private.fn_now(),
           meal_shift = v_shift
     where id = v_selection;
  end if;

  select array_agg((e ->> 'category_id')::uuid) into v_categories
  from jsonb_array_elements(p_items) e;

  delete from public.employee_selection_items
  where selection_id = v_selection and category_id <> all (v_categories);

  insert into public.employee_selection_items (selection_id, category_id, option_id)
  select v_selection, (e ->> 'category_id')::uuid, (e ->> 'option_id')::uuid
  from jsonb_array_elements(p_items) e
  on conflict (selection_id, category_id)
  do update set option_id = excluded.option_id
  where public.employee_selection_items.option_id is distinct from excluded.option_id;

  return v_selection;
end;
$$;

grant execute on function public.save_my_selection(uuid, jsonb, uuid, public.meal_shift) to authenticated;

comment on function public.save_my_selection(uuid, jsonb, uuid, public.meal_shift) is
  'Guarda la elección del empleado. Si la empresa separa turnos, p_meal_shift es obligatorio.';

drop function if exists public.save_employee_choice(uuid, uuid, jsonb);
create or replace function public.save_employee_choice(
  p_membership_id uuid,
  p_calendar_day_id uuid,
  p_items jsonb,
  p_meal_shift public.meal_shift default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user         uuid;
  v_company      uuid;
  v_selection    uuid;
  v_other_company text;
  v_shifts       boolean;
  v_shift        public.meal_shift := p_meal_shift;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_SELECTION',
      detail = 'Elegí al menos una opción.';
  end if;

  select m.user_id, m.company_id into v_user, v_company
  from public.memberships m
  where m.id = p_membership_id and m.role in ('EMPLOYEE', 'COMPANY_ADMIN');
  if v_user is null or not private.is_company_admin(v_company) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select c.meal_shifts_enabled into v_shifts from public.companies c where c.id = v_company;
  if coalesce(v_shifts, false) then
    if v_shift is null then
      raise exception using errcode = 'P0001', message = 'MEAL_SHIFT_REQUIRED',
        detail = 'Elegí si come a la mañana o a la tarde.';
    end if;
  else
    v_shift := null;
  end if;

  select co.nombre_comercial into v_other_company
  from public.employee_selections s
  join public.companies co on co.id = s.company_id
  where s.employee_id = v_user
    and s.calendar_day_id = p_calendar_day_id
    and s.status = 'SUBMITTED'
  limit 1;

  if v_other_company is not null then
    raise exception using errcode = 'P0001', message = 'ALREADY_CHOSEN',
      detail = format('Ya pidió ese día en %s. Hay que anular ese menú antes de cargar otro.', v_other_company);
  end if;

  insert into public.employee_selections (employee_id, company_id, calendar_day_id, meal_shift)
  values (v_user, v_company, p_calendar_day_id, v_shift)
  returning id into v_selection;

  insert into public.employee_selection_items (selection_id, category_id, option_id)
  select v_selection, (e ->> 'category_id')::uuid, (e ->> 'option_id')::uuid
  from jsonb_array_elements(p_items) e;

  return v_selection;
end;
$$;

grant execute on function public.save_employee_choice(uuid, uuid, jsonb, public.meal_shift) to authenticated, service_role;

comment on function public.save_employee_choice(uuid, uuid, jsonb, public.meal_shift) is
  'Encargado carga la elección de otra persona. Si la empresa separa turnos, p_meal_shift es obligatorio.';
