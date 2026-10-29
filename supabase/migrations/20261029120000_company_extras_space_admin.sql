-- Pedido grupal: Mora (ORG/SPACE admin) puede cargar extras por empresa.

drop policy if exists company_day_extras_insert on public.company_day_extras;
drop policy if exists company_day_extras_update on public.company_day_extras;

create policy company_day_extras_insert on public.company_day_extras
  for insert to authenticated
  with check (private.is_company_admin(company_id) or private.has_space_access(business_space_id));

create policy company_day_extras_update on public.company_day_extras
  for update to authenticated
  using (private.is_company_admin(company_id) or private.has_space_access(business_space_id))
  with check (private.is_company_admin(company_id) or private.has_space_access(business_space_id));

drop function if exists public.save_company_extras(uuid, jsonb);

create function public.save_company_extras(p_calendar_day_id uuid, p_items jsonb, p_company_id uuid default null)
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
  v_space_admin boolean := false;
begin
  if p_company_id is not null then
    select c.id, c.business_space_id into v_company, v_space
    from public.companies c
    where c.id = p_company_id;
    if v_company is null or not private.has_space_access(v_space) then
      raise exception using errcode = '42501', message = 'FORBIDDEN';
    end if;
    v_space_admin := true;
  else
    select m.company_id, m.business_space_id into v_company, v_space
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.role = 'COMPANY_ADMIN'
      and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today())
    limit 1;
    if v_company is null then
      raise exception using errcode = '42501', message = 'FORBIDDEN';
    end if;
  end if;

  select d.service_date, d.is_service_day into v_date, v_service
  from public.calendar_days d
  where d.id = p_calendar_day_id and d.business_space_id = v_space;
  if v_date is null or not v_service then
    raise exception using errcode = 'P0001', message = 'CALENDAR_DAY_NOT_FOUND';
  end if;
  if not v_space_admin and not private.is_within_selection_window(v_date, v_company) then
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

grant execute on function public.save_company_extras(uuid, jsonb, uuid) to authenticated, service_role;
