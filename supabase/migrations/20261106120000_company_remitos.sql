-- Remitos de entrega por empresa y día de servicio.
-- Un remito por (empresa, fecha); el detalle se congela al emitir.

create table public.remitos (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  company_id         uuid not null,
  service_date       date not null,
  point_of_sale      text not null default '0001' check (point_of_sale ~ '^[0-9]{4}$'),
  folio              bigint not null check (folio > 0),
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint remitos_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict,
  constraint remitos_company_date_key unique (company_id, service_date),
  constraint remitos_space_pos_folio_key unique (business_space_id, point_of_sale, folio)
);

comment on table public.remitos is
  'Remito de entrega. Un comprobante por empresa y fecha; folio secuencial por espacio.';

create table public.remito_items (
  id             uuid primary key default gen_random_uuid(),
  remito_id      uuid not null references public.remitos(id) on delete cascade,
  category_name  text not null,
  option_name    text not null,
  quantity       integer not null check (quantity > 0),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create index remito_items_remito_idx on public.remito_items (remito_id, sort_order, option_name);

comment on table public.remito_items is
  'Líneas del remito al momento de emitir (snapshot de producción).';

alter table public.remitos enable row level security;
alter table public.remito_items enable row level security;

create policy remitos_select on public.remitos
  for select to authenticated
  using (
    private.has_space_access(business_space_id)
    or private.is_company_admin(company_id)
  );

create policy remitos_insert on public.remitos
  for insert to authenticated
  with check (
    private.has_space_access(business_space_id)
    or private.is_company_admin(company_id)
  );

create policy remito_items_select on public.remito_items
  for select to authenticated
  using (
    exists (
      select 1 from public.remitos r
      where r.id = remito_id
        and (private.has_space_access(r.business_space_id) or private.is_company_admin(r.company_id))
    )
  );

create policy remito_items_insert on public.remito_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.remitos r
      where r.id = remito_id
        and (private.has_space_access(r.business_space_id) or private.is_company_admin(r.company_id))
    )
  );

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
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  select c.business_space_id into v_space
  from public.companies c
  where c.id = p_company_id and c.active;
  if v_space is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_NOT_AVAILABLE';
  end if;

  if not (private.has_space_access(v_space) or private.is_company_admin(p_company_id)) then
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

  insert into public.remito_items (remito_id, category_name, option_name, quantity, sort_order)
  select
    v_remito,
    m.category_name,
    m.option_name,
    m.quantity,
    m.sort_order
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
  'Devuelve el remito de esa empresa y fecha; si no existe, lo emite con snapshot de cantidades y folio nuevo.';

revoke execute on function public.get_or_create_remito(uuid, date) from public, anon;
grant execute on function public.get_or_create_remito(uuid, date) to authenticated, service_role;
grant select, insert on public.remitos to authenticated, service_role;
grant select, insert on public.remito_items to authenticated, service_role;
