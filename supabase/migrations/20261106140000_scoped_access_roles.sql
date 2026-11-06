-- Rol SCOPED: debe ir en su propia migración.
-- Postgres exige commit del valor nuevo del enum antes de usarlo.
alter type public.app_role add value if not exists 'SCOPED';
