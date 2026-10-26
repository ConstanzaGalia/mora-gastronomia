-- Documentos del espacio: habilitaciones, fumigación y otros archivos.

create table public.document_categories (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  name               text not null check (length(btrim(name)) > 0),
  slug               text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint document_categories_space_slug_key unique (business_space_id, slug),
  constraint document_categories_id_space_key unique (id, business_space_id)
);
comment on table public.document_categories is 'Tipos de documento del espacio (habilitaciones, fumigación, etc.). El nombre no se repite.';

create table public.space_documents (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  category_id        uuid not null,
  title              text not null check (length(btrim(title)) > 0),
  original_name      text not null check (length(btrim(original_name)) > 0),
  storage_path       text not null unique,
  mime_type          text not null,
  file_size          integer not null check (file_size > 0),
  issued_on          date,
  expires_on         date,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint space_documents_category_space_fkey
    foreign key (category_id, business_space_id)
    references public.document_categories(id, business_space_id) on delete restrict
);
comment on table public.space_documents is 'Archivos del espacio agrupados por categoría.';

create index space_documents_space_idx on public.space_documents (business_space_id, created_at desc);
create index space_documents_category_idx on public.space_documents (category_id);

create trigger set_updated_at before update on public.document_categories
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.space_documents
  for each row execute function private.set_updated_at();

alter table public.document_categories enable row level security;
alter table public.space_documents enable row level security;

create policy document_categories_select on public.document_categories
  for select to authenticated using (private.has_space_access(business_space_id));
create policy document_categories_insert on public.document_categories
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy document_categories_update on public.document_categories
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy document_categories_delete on public.document_categories
  for delete to authenticated using (private.has_space_access(business_space_id));

create policy space_documents_select on public.space_documents
  for select to authenticated using (private.has_space_access(business_space_id));
create policy space_documents_insert on public.space_documents
  for insert to authenticated with check (private.has_space_access(business_space_id));
create policy space_documents_update on public.space_documents
  for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy space_documents_delete on public.space_documents
  for delete to authenticated using (private.has_space_access(business_space_id));

grant select, insert, update, delete on public.document_categories to authenticated, service_role;
grant select, insert, update, delete on public.space_documents to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('space-documents', 'space-documents', false, 15728640)
on conflict (id) do nothing;
