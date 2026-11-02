-- Permitir cambiar de empresa al modificar una elección de menú existente.
-- Las viandas se actualizan correctamente porque el company_id determina el conteo.

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

  select s.id, s.company_id into v_selection, v_current
  from public.employee_selections s
  where s.employee_id = v_uid and s.calendar_day_id = p_calendar_day_id and s.status = 'SUBMITTED'
  for update;

  -- Si ya existe una selección pero para otra empresa, permitir cambiar la empresa.
  -- Esto actualiza correctamente el conteo de viandas por empresa.
  if v_selection is not null and v_current <> v_company then
    update public.employee_selections
       set company_id = v_company,
           submitted_at = private.fn_now()
     where id = v_selection;
  elsif v_selection is null then
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

grant execute on function public.save_my_selection(uuid, jsonb, uuid) to authenticated;

comment on function public.save_my_selection(uuid, jsonb, uuid) is
  'Guarda la elección del empleado. Si ya había una elección para otra empresa, actualiza el company_id permitiendo cambiar de empresa al modificar el menú.';
