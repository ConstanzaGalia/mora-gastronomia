-- La migración de esquema define RLS, pero esta versión local de Supabase
-- no otorga SELECT/INSERT/UPDATE/DELETE al crear tablas. Sin estos grants
-- la API rechaza todo antes de evaluar las políticas.
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
