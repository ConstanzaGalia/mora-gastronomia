-- Agregar soporte de turnos de comida en remitos
-- Los items del remito se agrupan por turno cuando la empresa tiene meal_shifts_enabled

alter table public.remito_items
  add column if not exists meal_shift public.meal_shift;

comment on column public.remito_items.meal_shift is
  'Turno de comida si la empresa tiene meal_shifts_enabled. NULL si no separa turnos.';

create index if not exists remito_items_meal_shift_idx 
  on public.remito_items (remito_id, meal_shift, sort_order, option_name);

-- Reescribir la función get_or_create_remito para soportar turnos
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
  v_shifts  boolean;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  select c.business_space_id, c.meal_shifts_enabled into v_space, v_shifts
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

  -- Si la empresa tiene turnos activados, agrupar por turno
  if coalesce(v_shifts, false) then
    insert into public.remito_items (remito_id, category_name, option_name, quantity, sort_order, meal_shift)
    select
      v_remito,
      m.category_name,
      m.option_name,
      m.quantity,
      m.sort_order,
      m.meal_shift
    from (
      select
        x.category_name,
        x.option_name,
        x.meal_shift,
        sum(x.qty)::integer as quantity,
        min(x.sort_order)::integer as sort_order
      from (
        select
          c.name as category_name,
          o.name as option_name,
          s.meal_shift,
          count(*)::integer as qty,
          c.sort_order
        from public.employee_selections s
        join public.employee_selection_items i on i.selection_id = s.id
        join public.gastronomic_categories c on c.id = i.category_id
        join public.gastronomic_options o on o.id = i.option_id
        where s.company_id = p_company_id
          and s.service_date = p_service_date
          and s.status = 'SUBMITTED'
        group by c.name, o.name, s.meal_shift, c.sort_order
        union all
        select
          c.name,
          o.name,
          null::public.meal_shift,
          e.quantity,
          c.sort_order
        from public.company_day_extras e
        join public.calendar_days d on d.id = e.calendar_day_id
        join public.gastronomic_categories c on c.id = e.category_id
        join public.gastronomic_options o on o.id = e.option_id
        where e.company_id = p_company_id
          and d.service_date = p_service_date
      ) x
      group by x.category_name, x.option_name, x.meal_shift
    ) m
    where m.quantity > 0
    order by 
      case m.meal_shift 
        when 'MORNING' then 1 
        when 'AFTERNOON' then 2 
        else 3 
      end,
      m.sort_order, 
      m.category_name, 
      m.option_name;
  else
    -- Sin turnos: comportamiento original
    insert into public.remito_items (remito_id, category_name, option_name, quantity, sort_order, meal_shift)
    select
      v_remito,
      m.category_name,
      m.option_name,
      m.quantity,
      m.sort_order,
      null
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
  end if;

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

comment on function public.get_or_create_remito(uuid, date) is
  'Busca o crea un remito. Si la empresa tiene turnos, agrupa los items por turno.';
