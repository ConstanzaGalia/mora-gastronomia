-- Cargos de ingreso libres por empresa. Reemplazan las horas facturadas.

create table public.company_charges (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  business_space_id  uuid not null,
  charged_on         date not null,
  concept            text not null check (length(btrim(concept)) > 0),
  amount             numeric(12,2) not null check (amount > 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint company_charges_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict
);
comment on table public.company_charges is 'Otros ingresos facturados a una empresa, con concepto y monto libres.';

create index company_charges_space_date_idx on public.company_charges (business_space_id, charged_on);
create index company_charges_company_idx on public.company_charges (company_id, charged_on);

create trigger set_updated_at before update on public.company_charges
  for each row execute function private.set_updated_at();

alter table public.company_charges enable row level security;

create policy company_charges_select on public.company_charges
  for select to authenticated using (private.has_space_access(business_space_id));
create policy company_charges_insert on public.company_charges
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy company_charges_update on public.company_charges
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy company_charges_delete on public.company_charges
  for delete to authenticated using (private.has_space_access(business_space_id));

grant select, insert, update, delete on public.company_charges to authenticated, service_role;

insert into public.company_charges (company_id, business_space_id, charged_on, concept, amount)
select
  e.company_id,
  e.business_space_id,
  e.worked_on,
  coalesce(nullif(btrim(e.note), ''), 'Horas'),
  round((e.hours * p.unit_price)::numeric, 2)
from public.company_hour_entries e
join lateral (
  select unit_price
  from public.company_hour_prices
  where company_id = e.company_id
    and effective_from <= e.worked_on
  order by effective_from desc
  limit 1
) p on true
where e.hours > 0
  and round((e.hours * p.unit_price)::numeric, 2) > 0;
