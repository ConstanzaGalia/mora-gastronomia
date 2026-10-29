-- Mercadito: cada día está abierto hasta que Mora lo cierra a mano desde Pedidos.
-- Una fila CERRADO cierra el día; sin fila está abierto. No afecta el horario de las empresas.

create table public.market_days (
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  service_date       date not null,
  state              text not null check (state in ('ABIERTO', 'CERRADO')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (business_space_id, service_date)
);
comment on table public.market_days is 'Días del mercadito que Mora cerró a mano (state CERRADO). Sin fila, el día está abierto.';

create trigger set_updated_at before update on public.market_days for each row execute function private.set_updated_at();

alter table public.market_days enable row level security;

create policy market_days_select on public.market_days
  for select to authenticated using (private.has_space_access(business_space_id));
create policy market_days_insert on public.market_days
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy market_days_update on public.market_days
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy market_days_delete on public.market_days
  for delete to authenticated using (private.has_space_access(business_space_id));

grant select, insert, update, delete on public.market_days to authenticated, service_role;
