-- Empleados que pueden pedir para más de una empresa (p. ej. Refinor Banda y Refinor Alter).
-- Cada día piden para UNA sola; la elección queda cargada a esa empresa (facturación separada).

-- 1. Una persona puede ser EMPLOYEE de varias empresas del mismo espacio; solo
--    se prohíbe superponer dos membresías en la misma empresa.
alter table public.memberships drop constraint memberships_employee_no_overlap;
alter table public.memberships
  add constraint memberships_employee_no_overlap
  exclude using gist (
    user_id with =,
    business_space_id with =,
    company_id with =,
    daterange(started_at, ended_at, '[]') with &&
  ) where (role = 'EMPLOYEE');

-- 2. Menú del día para una empresa puntual (null = todas las empresas del empleado).
drop function public.get_my_menu(date);
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
         private.selection_deadline(d.service_date),
         private.is_within_selection_window(d.service_date, co.id),
         exists (select 1
                 from public.employee_selections s
                 join public.employee_selection_items i on i.selection_id = s.id
                 where s.employee_id = (select auth.uid())
                   and s.calendar_day_id = d.id
                   and s.company_id = co.id
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
    and (p_company_id is null or co.id = p_company_id)
    and private.is_current_membership(m.status, m.started_at, m.ended_at, p_service_date)
  order by co.nombre_comercial, c.sort_order, c.name, a.sort_order, o.sort_order, o.name;
$$;

-- 3. Guardar la elección indicando la empresa. Con una sola empresa vigente no hace
--    falta indicarla; con dos es obligatorio. Para cambiar de empresa en un día ya
--    elegido hay que anular la elección primero.
drop function public.save_my_selection(uuid, jsonb);
create or replace function public.save_my_selection(
  p_calendar_day_id uuid,
  p_items jsonb,
  p_company_id uuid default null)
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
      and m.role = 'EMPLOYEE'
      and private.is_current_membership(m.status, m.started_at, m.ended_at, v_date);
    if v_count > 1 then
      raise exception using errcode = 'P0001', message = 'COMPANY_REQUIRED',
        detail = 'Elegí para qué empresa es el pedido.';
    end if;
  end if;
  if v_company is null then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_MEMBERSHIP';
  end if;

  select s.id, s.company_id into v_selection, v_current
  from public.employee_selections s
  where s.employee_id = v_uid and s.calendar_day_id = p_calendar_day_id and s.status = 'SUBMITTED'
  for update;

  if v_selection is not null and v_current <> v_company then
    raise exception using errcode = 'P0001', message = 'SELECTION_COMPANY_LOCKED',
      detail = 'Ya pediste ese día para otra empresa. Anulá la elección para pedir en la otra.';
  end if;

  if v_selection is null then
    insert into public.employee_selections (employee_id, company_id, calendar_day_id)
    values (v_uid, v_company, p_calendar_day_id)
    returning id into v_selection;
  else
    update public.employee_selections set submitted_at = private.fn_now() where id = v_selection;
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

revoke execute on function public.get_my_menu(date, uuid) from public, anon;
revoke execute on function public.save_my_selection(uuid, jsonb, uuid) from public, anon;
grant execute on function public.get_my_menu(date, uuid) to authenticated;
grant execute on function public.save_my_selection(uuid, jsonb, uuid) to authenticated;
