-- Sectores por empresa para agrupar el informe de comensales.

create table public.company_sectors (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  business_space_id  uuid not null,
  name               text not null check (length(btrim(name)) > 0),
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint company_sectors_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete cascade
);
comment on table public.company_sectors is 'Lista de sectores de una empresa. La arma Mora; el informe de comensales agrupa por acá.';

create unique index company_sectors_name_key
  on public.company_sectors (company_id, lower(btrim(name)));
create index company_sectors_company_idx on public.company_sectors (company_id, sort_order);

create trigger set_updated_at before update on public.company_sectors
  for each row execute function private.set_updated_at();

alter table public.memberships
  add column sector_id uuid references public.company_sectors(id) on delete set null;
comment on column public.memberships.sector_id is 'Sector de esa relación laboral. NULL = sin sector. No viaja si la persona cambia de empresa.';

create or replace function private.trg_membership_sector_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sector_id is null then
    return new;
  end if;
  if new.company_id is null
     or not exists (
       select 1
       from public.company_sectors s
       where s.id = new.sector_id
         and s.company_id = new.company_id
     ) then
    raise exception using errcode = 'P0001', message = 'SECTOR_COMPANY_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger memberships_sector_company
  before insert or update of sector_id, company_id on public.memberships
  for each row execute function private.trg_membership_sector_company();

alter table public.company_sectors enable row level security;

create policy company_sectors_select on public.company_sectors
  for select to authenticated using (private.can_view_company(company_id));
create policy company_sectors_insert on public.company_sectors
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy company_sectors_update on public.company_sectors
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy company_sectors_delete on public.company_sectors
  for delete to authenticated using (private.has_space_access(business_space_id));

grant select, insert, update, delete on public.company_sectors to authenticated, service_role;
