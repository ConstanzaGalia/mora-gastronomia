-- Vincular a una segunda empresa no cierra la membresía de la primera.

create or replace function public.add_company_member(
  p_company_id uuid,
  p_dni        text,
  p_role       public.app_role default 'EMPLOYEE',
  p_started_at date default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_start   date := coalesce(p_started_at, private.fn_today());
  v_company public.companies%rowtype;
  v_org     uuid;
  v_user    uuid;
  v_active  boolean;
  v_id      uuid;
  r         record;
begin
  if p_role not in ('EMPLOYEE', 'COMPANY_ADMIN') then
    raise exception using errcode = 'P0001', message = 'INVALID_ROLE';
  end if;

  select * into v_company from public.companies where id = p_company_id;
  if not found or not private.can_manage_company(p_company_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_role = 'COMPANY_ADMIN' and not private.has_space_access(v_company.business_space_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN',
      detail = 'Solo Mora o el admin del espacio designan administradores de empresa.';
  end if;
  if not v_company.active then
    raise exception using errcode = 'P0001', message = 'COMPANY_INACTIVE';
  end if;

  select s.organization_id into v_org from public.business_spaces s where s.id = v_company.business_space_id;

  select p.id, p.activo into v_user, v_active
  from public.profiles p
  where p.dni = regexp_replace(coalesce(p_dni, ''), '[^0-9]', '', 'g');
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND',
      detail = 'No existe identidad con ese DNI: crear primero el usuario en Supabase Auth.';
  end if;
  if not v_active then
    raise exception using errcode = 'P0001', message = 'PROFILE_INACTIVE';
  end if;

  if p_role = 'EMPLOYEE' then
    select m.id into v_id from public.memberships m
    where m.user_id = v_user and m.company_id = p_company_id and m.role = 'EMPLOYEE'
      and private.is_current_membership(m.status, m.started_at, m.ended_at, v_start);
    if v_id is not null then
      return v_id;
    end if;

    for r in
      select m.id, m.started_at from public.memberships m
      where m.user_id = v_user
        and m.company_id = p_company_id
        and m.role = 'EMPLOYEE'
        and (m.ended_at is null or m.ended_at >= v_start)
    loop
      if r.started_at >= v_start then
        raise exception using errcode = 'P0001', message = 'MEMBERSHIP_CONFLICT',
          detail = 'Existe otra membership que comienza en o después de esa fecha.';
      end if;
      perform private.close_membership(r.id, v_start - 1);
    end loop;
  else
    select m.id into v_id from public.memberships m
    where m.user_id = v_user and m.company_id = p_company_id and m.role = 'COMPANY_ADMIN'
      and m.status = 'ACTIVE' and m.ended_at is null;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.memberships (user_id, organization_id, business_space_id, company_id, role, status, started_at, created_by)
  values (v_user, v_org, v_company.business_space_id, p_company_id, p_role, 'ACTIVE', v_start, (select auth.uid()))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.add_company_member(uuid, text, public.app_role, date) is
  'Suma a la persona a esa empresa. No cierra membresías de otras empresas.';
