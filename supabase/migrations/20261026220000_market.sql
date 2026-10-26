-- Mercadito de Balcarce: pedidos públicos del menú publicado del día.

create type public.market_order_status as enum ('NUEVO', 'LISTO', 'CANCELADO');

create table public.market_settings (
  business_space_id  uuid primary key references public.business_spaces(id) on delete restrict,
  enabled            boolean not null default true,
  unit_price         numeric(12,2) check (unit_price is null or unit_price >= 0),
  whatsapp           text,
  transfer_holder    text,
  transfer_alias     text,
  transfer_cbu       text,
  transfer_bank      text,
  delivery_note      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.market_settings is 'Precio, WhatsApp y datos de transferencia del mercadito público.';

create table public.market_orders (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  service_date       date not null,
  customer_name      text not null check (length(btrim(customer_name)) > 0),
  phone              text not null check (length(btrim(phone)) > 0),
  address            text not null check (length(btrim(address)) > 0),
  payment_method     public.payment_method not null check (payment_method <> 'ECHEQ'),
  status             public.market_order_status not null default 'NUEVO',
  notes              text,
  total              numeric(12,2) not null check (total >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint market_orders_id_space_key unique (id, business_space_id)
);
comment on table public.market_orders is 'Pedidos del mercadito. Los hace cualquiera con el link, sin cuenta.';

create table public.market_order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null,
  business_space_id  uuid not null,
  option_id          uuid references public.gastronomic_options(id) on delete set null,
  category_name      text not null,
  option_name        text not null,
  quantity           integer not null check (quantity > 0),
  unit_price         numeric(12,2) not null check (unit_price >= 0),
  amount             numeric(12,2) not null check (amount >= 0),
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  constraint market_order_items_order_space_fkey
    foreign key (order_id, business_space_id)
    references public.market_orders(id, business_space_id) on delete cascade
);

create index market_orders_space_date_idx on public.market_orders (business_space_id, service_date, created_at desc);
create index market_order_items_order_idx on public.market_order_items (order_id);

create trigger set_updated_at before update on public.market_settings for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.market_orders for each row execute function private.set_updated_at();

alter table public.market_settings enable row level security;
alter table public.market_orders enable row level security;
alter table public.market_order_items enable row level security;

create policy market_settings_select on public.market_settings
  for select to authenticated using (private.has_space_access(business_space_id));
create policy market_settings_insert on public.market_settings
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy market_settings_update on public.market_settings
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));

create policy market_orders_select on public.market_orders
  for select to authenticated using (private.has_space_access(business_space_id));
create policy market_orders_update on public.market_orders
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));

create policy market_order_items_select on public.market_order_items
  for select to authenticated using (private.has_space_access(business_space_id));

grant select, insert, update on public.market_settings to authenticated, service_role;
grant select, insert, update, delete on public.market_orders to authenticated, service_role;
grant select, insert, delete on public.market_order_items to authenticated, service_role;

insert into public.market_settings (business_space_id, enabled, unit_price, whatsapp)
select id, true, 8000, '5493813201368'
from public.business_spaces
where slug = 'balcarce'
on conflict (business_space_id) do nothing;
