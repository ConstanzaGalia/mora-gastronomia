-- El pedido del mercadito nace recibido. Entra a cocina cuando Mora lo confirma.
-- La plata se marca aparte, cuando se cobra.

alter table public.market_orders alter column status drop default;

alter type public.market_order_status rename value 'NUEVO' to 'RECIBIDO';
alter type public.market_order_status rename value 'LISTO' to 'ENTREGADO';
alter type public.market_order_status add value 'CONFIRMADO';

alter table public.market_orders
  alter column status set default 'RECIBIDO';

alter table public.market_orders
  add column paid boolean not null default false,
  add column after_cutoff boolean not null default false;

comment on column public.market_orders.status is 'RECIBIDO no entra a cocina. CONFIRMADO y ENTREGADO sí. CANCELADO no suma.';
comment on column public.market_orders.paid is 'True cuando entró la plata: efectivo al entregar o comprobante de transferencia.';
comment on column public.market_orders.after_cutoff is 'True si llegó después de las 12:00 del día anterior. Sigue recibido hasta que Mora lo confirma.';
