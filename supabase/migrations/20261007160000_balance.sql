-- Precios por bandeja, cobros y gastos del espacio.
-- El precio vigente es el último con effective_from <= fecha del servicio.

create table public.company_tray_prices (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  business_space_id  uuid not null,
  unit_price         numeric(12,2) not null check (unit_price >= 0),
  effective_from     date not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint company_tray_prices_company_from_key unique (company_id, effective_from),
  constraint company_tray_prices_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict
);
comment on table public.company_tray_prices is 'Precio por bandeja de cada empresa, vigente desde effective_from.';

create table public.company_payments (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  business_space_id  uuid not null,
  paid_on            date not null,
  amount             numeric(12,2) not null check (amount > 0),
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint company_payments_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict
);
comment on table public.company_payments is 'Cobros anotados de una empresa. No son automáticos.';

create table public.space_expenses (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  spent_on           date not null,
  concept            text not null check (length(btrim(concept)) > 0),
  amount             numeric(12,2) not null check (amount > 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.space_expenses is 'Gastos del espacio. No se asignan a una empresa.';

create index company_tray_prices_company_idx on public.company_tray_prices (company_id, effective_from);
create index company_payments_space_date_idx on public.company_payments (business_space_id, paid_on);
create index space_expenses_space_date_idx on public.space_expenses (business_space_id, spent_on);

create trigger set_updated_at before update on public.company_tray_prices for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.company_payments for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.space_expenses for each row execute function private.set_updated_at();

alter table public.company_tray_prices enable row level security;
alter table public.company_payments enable row level security;
alter table public.space_expenses enable row level security;

create policy company_tray_prices_select on public.company_tray_prices
  for select to authenticated using (private.has_space_access(business_space_id));
create policy company_tray_prices_insert on public.company_tray_prices
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy company_tray_prices_update on public.company_tray_prices
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy company_tray_prices_delete on public.company_tray_prices
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy company_payments_select on public.company_payments
  for select to authenticated using (private.has_space_access(business_space_id));
create policy company_payments_insert on public.company_payments
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy company_payments_update on public.company_payments
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy company_payments_delete on public.company_payments
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy space_expenses_select on public.space_expenses
  for select to authenticated using (private.has_space_access(business_space_id));
create policy space_expenses_insert on public.space_expenses
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy space_expenses_update on public.space_expenses
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy space_expenses_delete on public.space_expenses
  for delete to authenticated using (private.has_space_access(business_space_id));

grant select, insert, update, delete on public.company_tray_prices to authenticated, service_role;
grant select, insert, update, delete on public.company_payments to authenticated, service_role;
grant select, insert, update, delete on public.space_expenses to authenticated, service_role;

-- Agrupa bandejas elegidas (categoría slug bandeja, no canceladas) hasta una fecha.
create or replace function public.tray_days_until(p_space_id uuid, p_until date)
returns table (company_id uuid, service_date date, trays integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select es.company_id, es.service_date, count(*)::integer
  from public.employee_selections es
  join public.employee_selection_items esi on esi.selection_id = es.id
  join public.gastronomic_categories gc on gc.id = esi.category_id
  where es.business_space_id = p_space_id
    and gc.business_space_id = p_space_id
    and gc.slug = 'bandeja'
    and es.status = 'SUBMITTED'
    and es.service_date <= p_until
  group by es.company_id, es.service_date
$$;

grant execute on function public.tray_days_until(uuid, date) to authenticated, service_role;
