-- =====================================================================
-- MORA GASTRONOMÍA · PLATAFORMA v1 · DATOS INICIALES
-- Archivo : supabase/seed.sql
-- Idempotente. NO crea usuarios ni contraseñas (se crean vía Supabase Auth).
-- =====================================================================

-- Organización
insert into public.organizations (name, slug)
values ('Mora Gastronomía', 'mora-gastronomia')
on conflict (slug) do nothing;

-- Espacios de negocio
insert into public.business_spaces (organization_id, name, slug, description)
select o.id, v.name, v.slug, v.description
from public.organizations o
cross join (values
  ('Balcarce', 'balcarce', 'Servicio de viandas para empresas'),
  ('Eventos', 'eventos', 'Catering y organización de eventos')
) as v(name, slug, description)
where o.slug = 'mora-gastronomia'
on conflict (organization_id, slug) do nothing;

-- Categorías del catálogo de Balcarce
insert into public.gastronomic_categories (business_space_id, name, slug, sort_order)
select s.id, v.name, v.slug, v.sort_order
from public.business_spaces s
cross join (values
  ('Bandeja', 'bandeja', 10),
  ('Postre',  'postre',  20),
  ('Bebida',  'bebida',  30),
  ('Pan',     'pan',     40)
) as v(name, slug, sort_order)
where s.slug = 'balcarce'
on conflict (business_space_id, slug) do nothing;

-- Catálogo de opciones (bandejas, postres, bebidas):
--   node scripts/seed-gastronomic-catalog.mjs
-- Lee scripts/data/gastronomic-catalog.json y hace upsert en gastronomic_options.
--
-- Proveedores de Balcarce:
--   node scripts/seed-suppliers.mjs
-- Lee scripts/data/suppliers.json y hace upsert en suppliers (el rubro queda en el JSON;
-- la tabla solo tiene name).
--
-- Empresas de Balcarce:
--   node scripts/seed-companies.mjs
-- Lee scripts/data/companies.json, crea las empresas y les habilita las categorías del catálogo.

insert into public.market_settings (business_space_id, enabled, unit_price, whatsapp)
select s.id, true, 8000, '5493813201368'
from public.business_spaces s
where s.slug = 'balcarce'
on conflict (business_space_id) do nothing;

-- ---------------------------------------------------------------------
-- BOOTSTRAP DEL PRIMER ADMIN DE MORA (ejecutar a mano, una sola vez,
-- después de crear el usuario en Supabase Auth con user_metadata
-- { dni, nombre, apellido }). Reemplazar el DNI:
--
-- insert into public.memberships (user_id, organization_id, role)
-- select p.id, o.id, 'ORG_ADMIN'
-- from public.profiles p, public.organizations o
-- where p.dni = 'DNI_DEL_ADMIN' and o.slug = 'mora-gastronomia';
-- ---------------------------------------------------------------------
