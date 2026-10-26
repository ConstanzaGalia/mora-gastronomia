-- Espacio Eventos: organización de catering, gastos y cobros por evento.

insert into public.business_spaces (organization_id, name, slug, description)
select o.id, 'Eventos', 'eventos', 'Catering y organización de eventos'
from public.organizations o
where o.slug = 'mora-gastronomia'
on conflict (organization_id, slug) do nothing;

create type public.event_status as enum ('BORRADOR', 'CONFIRMADO', 'REALIZADO', 'CANCELADO');

create table public.events (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  name               text not null check (length(btrim(name)) > 0),
  client_name        text not null check (length(btrim(client_name)) > 0),
  client_phone       text,
  client_email       text,
  event_on           date not null,
  event_time         time,
  venue              text,
  guest_count        integer check (guest_count is null or guest_count >= 0),
  notes              text,
  quoted_amount      numeric(12,2) not null check (quoted_amount >= 0),
  status             public.event_status not null default 'BORRADOR',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint events_id_space_key unique (id, business_space_id)
);
comment on table public.events is 'Servicios de catering. El monto acordado es lo que debe el cliente; el menú lleva costo interno aparte.';

create table public.event_items (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null,
  business_space_id  uuid not null,
  name               text not null check (length(btrim(name)) > 0),
  quantity           numeric(12,2) not null check (quantity > 0),
  unit_cost          numeric(12,2) not null check (unit_cost >= 0),
  notes              text,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint event_items_event_space_fkey
    foreign key (event_id, business_space_id)
    references public.events(id, business_space_id) on delete cascade
);
comment on table public.event_items is 'Ítems de catering con costo interno. No suman al cobro del cliente.';

create table public.event_expenses (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null,
  business_space_id  uuid not null,
  spent_on           date not null,
  concept            text not null check (length(btrim(concept)) > 0),
  amount             numeric(12,2) not null check (amount > 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint event_expenses_event_space_fkey
    foreign key (event_id, business_space_id)
    references public.events(id, business_space_id) on delete cascade
);
comment on table public.event_expenses is 'Gastos puntuales de un evento (alquiler, personal, flete, etc.).';

create table public.event_payments (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null,
  business_space_id  uuid not null,
  paid_on            date not null,
  amount             numeric(12,2) not null check (amount > 0),
  method             public.payment_method not null,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint event_payments_event_space_fkey
    foreign key (event_id, business_space_id)
    references public.events(id, business_space_id) on delete cascade
);
comment on table public.event_payments is 'Cobros del cliente. Varias filas = seña y pagos parciales.';

create index events_space_date_idx on public.events (business_space_id, event_on);
create index event_items_event_idx on public.event_items (event_id);
create index event_expenses_event_idx on public.event_expenses (event_id, spent_on);
create index event_payments_event_idx on public.event_payments (event_id, paid_on);

create trigger set_updated_at before update on public.events for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.event_items for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.event_expenses for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.event_payments for each row execute function private.set_updated_at();

alter table public.events enable row level security;
alter table public.event_items enable row level security;
alter table public.event_expenses enable row level security;
alter table public.event_payments enable row level security;

create policy events_select on public.events
  for select to authenticated using (private.has_space_access(business_space_id));
create policy events_insert on public.events
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy events_update on public.events
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy events_delete on public.events
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy event_items_select on public.event_items
  for select to authenticated using (private.has_space_access(business_space_id));
create policy event_items_insert on public.event_items
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy event_items_update on public.event_items
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy event_items_delete on public.event_items
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy event_expenses_select on public.event_expenses
  for select to authenticated using (private.has_space_access(business_space_id));
create policy event_expenses_insert on public.event_expenses
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy event_expenses_update on public.event_expenses
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy event_expenses_delete on public.event_expenses
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy event_payments_select on public.event_payments
  for select to authenticated using (private.has_space_access(business_space_id));
create policy event_payments_insert on public.event_payments
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy event_payments_update on public.event_payments
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy event_payments_delete on public.event_payments
  for delete to authenticated using (private.has_space_access(business_space_id));

grant select, insert, update, delete on public.events to authenticated, service_role;
grant select, insert, update, delete on public.event_items to authenticated, service_role;
grant select, insert, update, delete on public.event_expenses to authenticated, service_role;
grant select, insert, update, delete on public.event_payments to authenticated, service_role;
