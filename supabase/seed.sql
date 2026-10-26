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

-- Opciones de ejemplo
insert into public.gastronomic_options (category_id, name, sort_order)
select c.id, v.name, v.sort_order
from public.gastronomic_categories c
join public.business_spaces s on s.id = c.business_space_id and s.slug = 'balcarce'
join (values
  ('bandeja', 'Milanesa con puré', 10),
  ('bandeja', 'Pollo',             20),
  ('bandeja', 'Pasta',             30),
  ('postre',  'Flan',              10),
  ('postre',  'Fruta',             20),
  ('postre',  'Yogur',             30),
  ('bebida',  'Agua',              10),
  ('bebida',  'Gaseosa',           20),
  ('bebida',  'Jugo',              30),
  ('pan',     'Pan francés',       10),
  ('pan',     'Pan integral',      20)
) as v(category_slug, name, sort_order) on v.category_slug = c.slug
on conflict (category_id, name) do nothing;

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
