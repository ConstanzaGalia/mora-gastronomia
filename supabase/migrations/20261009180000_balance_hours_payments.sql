-- Horas por empresa, pagos a proveedores y gastos fijos mensuales.
-- Un pago pendiente o un mes no pagado no entra en el resultado.

create type public.payment_method as enum ('EFECTIVO', 'TRANSFERENCIA', 'ECHEQ');
create type public.payment_status as enum ('PENDIENTE', 'PAGADO');
create type public.fixed_month_status as enum ('PENDIENTE', 'PAGADO', 'NO_APLICA');

create table public.company_hour_prices (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  business_space_id  uuid not null,
  unit_price         numeric(12,2) not null check (unit_price >= 0),
  effective_from     date not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint company_hour_prices_company_from_key unique (company_id, effective_from),
  constraint company_hour_prices_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict
);
comment on table public.company_hour_prices is 'Precio por hora de cada empresa, vigente desde effective_from.';

create table public.company_hour_entries (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  business_space_id  uuid not null,
  worked_on          date not null,
  hours              numeric(8,2) not null check (hours > 0),
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint company_hour_entries_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict
);
comment on table public.company_hour_entries is 'Horas cargadas a una empresa. Se facturan al precio vigente de ese día.';

create table public.suppliers (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  name               text not null check (length(btrim(name)) > 0),
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint suppliers_id_space_key unique (id, business_space_id),
  constraint suppliers_space_name_key unique (business_space_id, name)
);
comment on table public.suppliers is 'Proveedores del espacio.';

create table public.supplier_payments (
  id                 uuid primary key default gen_random_uuid(),
  supplier_id        uuid not null,
  business_space_id  uuid not null,
  paid_on            date not null,
  concept            text not null check (length(btrim(concept)) > 0),
  amount             numeric(12,2) not null check (amount > 0),
  method             public.payment_method not null,
  status             public.payment_status not null default 'PENDIENTE',
  echeq_number       text,
  echeq_date         date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint supplier_payments_supplier_space_fkey
    foreign key (supplier_id, business_space_id)
    references public.suppliers(id, business_space_id) on delete restrict,
  constraint supplier_payments_echeq_check check (
    (method = 'ECHEQ' and echeq_number is not null and length(btrim(echeq_number)) > 0 and echeq_date is not null)
    or (method <> 'ECHEQ' and echeq_number is null and echeq_date is null)
  )
);
comment on table public.supplier_payments is 'Pagos a proveedores. Solo los pagados entran en el mes, por la fecha de pago.';

create table public.fixed_expenses (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  name               text not null check (length(btrim(name)) > 0),
  sort_order         integer not null default 0,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint fixed_expenses_id_space_key unique (id, business_space_id),
  constraint fixed_expenses_space_name_key unique (business_space_id, name)
);
comment on table public.fixed_expenses is 'Servicios fijos del espacio, como alquiler o contador.';

create table public.fixed_expense_months (
  id                 uuid primary key default gen_random_uuid(),
  fixed_expense_id   uuid not null,
  business_space_id  uuid not null,
  year               integer not null check (year between 2000 and 2100),
  month              integer not null check (month between 1 and 12),
  status             public.fixed_month_status not null,
  amount             numeric(12,2),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint fixed_expense_months_unique unique (fixed_expense_id, year, month),
  constraint fixed_expense_months_expense_space_fkey
    foreign key (fixed_expense_id, business_space_id)
    references public.fixed_expenses(id, business_space_id) on delete restrict,
  constraint fixed_expense_months_amount_check check (
    (status = 'PAGADO' and amount is not null and amount > 0)
    or (status <> 'PAGADO' and amount is null)
  )
);
comment on table public.fixed_expense_months is 'Estado de un gasto fijo en un mes. El monto solo existe si está pagado.';

create index company_hour_prices_company_idx on public.company_hour_prices (company_id, effective_from);
create index company_hour_entries_company_idx on public.company_hour_entries (company_id, worked_on);
create index supplier_payments_space_date_idx on public.supplier_payments (business_space_id, paid_on);
create index fixed_expense_months_space_idx on public.fixed_expense_months (business_space_id, year, month);

create trigger set_updated_at before update on public.company_hour_prices for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.company_hour_entries for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.suppliers for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.supplier_payments for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.fixed_expenses for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.fixed_expense_months for each row execute function private.set_updated_at();

alter table public.company_hour_prices enable row level security;
alter table public.company_hour_entries enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.fixed_expense_months enable row level security;

create policy company_hour_prices_select on public.company_hour_prices
  for select to authenticated using (private.has_space_access(business_space_id));
create policy company_hour_prices_insert on public.company_hour_prices
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy company_hour_prices_update on public.company_hour_prices
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy company_hour_prices_delete on public.company_hour_prices
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy company_hour_entries_select on public.company_hour_entries
  for select to authenticated using (private.has_space_access(business_space_id));
create policy company_hour_entries_insert on public.company_hour_entries
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy company_hour_entries_update on public.company_hour_entries
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy company_hour_entries_delete on public.company_hour_entries
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy suppliers_select on public.suppliers
  for select to authenticated using (private.has_space_access(business_space_id));
create policy suppliers_insert on public.suppliers
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy suppliers_delete on public.suppliers
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy supplier_payments_select on public.supplier_payments
  for select to authenticated using (private.has_space_access(business_space_id));
create policy supplier_payments_insert on public.supplier_payments
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy supplier_payments_update on public.supplier_payments
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy supplier_payments_delete on public.supplier_payments
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy fixed_expenses_select on public.fixed_expenses
  for select to authenticated using (private.has_space_access(business_space_id));
create policy fixed_expenses_insert on public.fixed_expenses
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy fixed_expenses_update on public.fixed_expenses
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy fixed_expenses_delete on public.fixed_expenses
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy fixed_expense_months_select on public.fixed_expense_months
  for select to authenticated using (private.has_space_access(business_space_id));
create policy fixed_expense_months_insert on public.fixed_expense_months
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy fixed_expense_months_update on public.fixed_expense_months
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy fixed_expense_months_delete on public.fixed_expense_months
  for delete to authenticated using (private.has_space_access(business_space_id));

grant select, insert, update, delete on public.company_hour_prices to authenticated, service_role;
grant select, insert, update, delete on public.company_hour_entries to authenticated, service_role;
grant select, insert, update, delete on public.suppliers to authenticated, service_role;
grant select, insert, update, delete on public.supplier_payments to authenticated, service_role;
grant select, insert, update, delete on public.fixed_expenses to authenticated, service_role;
grant select, insert, update, delete on public.fixed_expense_months to authenticated, service_role;
