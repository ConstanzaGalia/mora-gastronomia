-- Gasto suelto puede ir a la cuenta corriente de un proveedor. Sin proveedor, queda como hoy.

alter table public.space_expenses
  add column if not exists supplier_id uuid;

alter table public.space_expenses
  drop constraint if exists space_expenses_supplier_space_fkey;

alter table public.space_expenses
  add constraint space_expenses_supplier_space_fkey
    foreign key (supplier_id, business_space_id)
    references public.suppliers(id, business_space_id) on delete restrict;

create index if not exists space_expenses_supplier_idx
  on public.space_expenses (supplier_id)
  where supplier_id is not null;

comment on table public.space_expenses is
  'Gastos del espacio. Si tienen proveedor, son un cargo a su cuenta corriente; si no, cuentan en el mes.';
comment on column public.space_expenses.supplier_id is
  'Proveedor opcional. Vacío = gasto suelto. Con valor = cargo a la cuenta corriente.';
