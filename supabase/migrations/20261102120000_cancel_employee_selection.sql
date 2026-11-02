-- Encargado puede anular un menú hasta las 9:00 del día del servicio.
-- Mora (acceso de espacio) puede anular en cualquier momento.

create or replace function private.company_admin_can_cancel(p_service_date date, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_company_admin(p_company_id)
     and private.fn_now() < (p_service_date::timestamp + time '09:00') at time zone 'America/Argentina/Tucuman';
$$;

comment on function private.company_admin_can_cancel(date, uuid) is
  'Encargado de esa empresa y todavía no son las 9:00 de Tucumán del día del servicio.';

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

  if old.status = 'CANCELLED' then
    raise exception using errcode = 'P0001', message = 'SELECTION_CANCELLED';
  end if;

  if new.status = 'CANCELLED' then
    if not (
      private.is_within_selection_window(old.service_date, old.company_id)
      or private.company_admin_can_cancel(old.service_date, old.company_id)
      or private.has_space_access(old.business_space_id)
    ) then
      raise exception using errcode = 'P0001', message = 'SELECTION_LOCKED',
        detail = 'La elección ya está cerrada y no puede modificarse.';
    end if;
    new.cancelled_at := v_now;
    return new;
  end if;

  if not private.is_within_selection_window(old.service_date, old.company_id) then
    raise exception using errcode = 'P0001', message = 'SELECTION_LOCKED',
      detail = 'La elección ya está cerrada y no puede modificarse.';
  end if;
  new.submitted_at := v_now;
  return new;
end;
$$;

create or replace function public.cancel_employee_selection(p_selection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.employee_selections%rowtype;
begin
  select * into v_row
  from public.employee_selections
  where id = p_selection_id and status = 'SUBMITTED';
  if not found then
    raise exception using errcode = 'P0001', message = 'SELECTION_NOT_FOUND';
  end if;

  if private.has_space_access(v_row.business_space_id) then
    null;
  elsif private.is_company_admin(v_row.company_id) then
    if not private.company_admin_can_cancel(v_row.service_date, v_row.company_id) then
      raise exception using errcode = 'P0001', message = 'SELECTION_LOCKED',
        detail = 'El plazo para anular ya cerró.';
    end if;
  else
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  update public.employee_selections
     set status = 'CANCELLED'
   where id = p_selection_id
     and status = 'SUBMITTED';
  if not found then
    raise exception using errcode = 'P0001', message = 'SELECTION_NOT_FOUND';
  end if;
end;
$$;

comment on function public.cancel_employee_selection(uuid) is
  'Anula la elección de otra persona. Encargado hasta las 9:00 del día; Mora sin horario.';

revoke execute on function public.cancel_employee_selection(uuid) from public, anon;
grant execute on function public.cancel_employee_selection(uuid) to authenticated, service_role;
