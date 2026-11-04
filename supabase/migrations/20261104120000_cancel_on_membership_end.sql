-- Al dar de baja: anular menús SUBMITTED de días posteriores, aunque el plazo ya haya cerrado.
-- El trigger permite esa anulación cuando la membership ya no cubre el día del servicio.
-- save_employee_choice indica en qué empresa pidió si ya hay menú ese día.

create or replace function private.close_membership(p_membership_id uuid, p_ended_at date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.memberships%rowtype;
begin
  select * into v_m from public.memberships where id = p_membership_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_NOT_FOUND';
  end if;
  if p_ended_at < v_m.started_at then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_CONFLICT',
      detail = 'La fecha de baja es anterior al inicio de la membership.';
  end if;

  update public.memberships
     set ended_at = p_ended_at,
         status   = case when p_ended_at < private.fn_today()
                         then 'ENDED'::public.membership_status else status end
   where id = p_membership_id;

  -- Días posteriores a la baja: se anulan siempre, para no dejar pedidos fantasma
  -- que bloqueen elegir en otra empresa. El día de la baja se conserva.
  update public.employee_selections
     set status = 'CANCELLED'
   where membership_id = p_membership_id
     and status = 'SUBMITTED'
     and service_date > p_ended_at;
end;
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

  if not private.is_within_selection_window(old.service_date, old.company_id) then
    raise exception using errcode = 'P0001', message = 'SELECTION_LOCKED',
      detail = 'La elección ya está cerrada y no puede modificarse.';
  end if;
  new.submitted_at := v_now;
  return new;
end;
$$;

create or replace function public.save_employee_choice(p_membership_id uuid, p_calendar_day_id uuid, p_items jsonb)
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

  insert into public.employee_selections (employee_id, company_id, calendar_day_id)
  values (v_user, v_company, p_calendar_day_id)
  returning id into v_selection;

  insert into public.employee_selection_items (selection_id, category_id, option_id)
  select v_selection, (e ->> 'category_id')::uuid, (e ->> 'option_id')::uuid
  from jsonb_array_elements(p_items) e;

  return v_selection;
end;
$$;
