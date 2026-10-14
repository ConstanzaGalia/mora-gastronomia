-- =====================================================================
-- MORA GASTRONOMÍA · PLATAFORMA v1 · MIGRACIÓN INICIAL DE ESQUEMA
-- Archivo : supabase/migrations/20261006120000_mora_v1_schema.sql
-- Motor   : Supabase PostgreSQL 15+
-- TZ      : America/Argentina/Tucuman (todas las fechas de negocio)
--
-- Orden:
--    0. Extensiones y esquemas
--    1. Enums
--    2. Reloj del sistema
--    3. Tablas
--    4. Índices
--    5. Funciones auxiliares (schema private)
--    6. Triggers
--    7. Row Level Security
--    8. Vistas de reporte
--    9. RPCs públicas (API para Next.js)
--   10. Privilegios
--
-- Convenciones de errores de negocio: SQLSTATE P0001, MESSAGE = código
-- estable en inglés (ej. SELECTION_LOCKED), DETAIL = texto en castellano.
-- =====================================================================

-- =====================================================================
-- 0. EXTENSIONES Y ESQUEMAS
-- =====================================================================
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;  -- exclusión por rangos de fechas

create schema if not exists private;
comment on schema private is
  'Funciones internas (helpers de RLS, validaciones, triggers). NO agregar a los schemas expuestos por la API.';
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- =====================================================================
-- 1. ENUMS
-- =====================================================================
create type public.app_role as enum (
  'ORG_ADMIN',      -- ex ADMIN_MORA: toda la organización
  'SPACE_ADMIN',    -- ex ADMIN_BALCARCE: un business_space (Balcarce hoy; Eventos/Copa mañana)
  'COMPANY_ADMIN',  -- administra una empresa cliente
  'EMPLOYEE'        -- empleado de una empresa cliente
);
comment on type public.app_role is
  'Roles con alcance. El alcance (organización / espacio / empresa) lo define la membership, no el nombre del rol. Para agregar roles: ALTER TYPE ... ADD VALUE + ajustar memberships_scope_chk.';

create type public.membership_status as enum ('ACTIVE', 'SUSPENDED', 'ENDED');
create type public.calendar_week_status as enum ('DRAFT', 'PUBLISHED');
create type public.selection_status as enum ('SUBMITTED', 'CANCELLED');

-- =====================================================================
-- 2. RELOJ DEL SISTEMA
-- =====================================================================
-- Toda regla temporal usa private.fn_now(). En producción devuelve now().
-- Solo en sesiones directas de postgres/supabase_admin (SQL editor, psql,
-- tests) permite simular la hora con: set app.fake_now = '2026-10-13 12:01-03'.
-- Las requests de la API (session_user = authenticator) SIEMPRE usan now().
create or replace function private.fn_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
           when session_user in ('postgres', 'supabase_admin')
                and nullif(current_setting('app.fake_now', true), '') is not null
             then current_setting('app.fake_now', true)::timestamptz
           else now()
         end;
$$;

create or replace function private.fn_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (private.fn_now() at time zone 'America/Argentina/Tucuman')::date;
$$;
comment on function private.fn_today() is 'Fecha de negocio actual en America/Argentina/Tucuman.';

-- =====================================================================
-- 3. TABLAS
-- =====================================================================

-- 3.1 Organizaciones ---------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint organizations_slug_key unique (slug)
);
comment on table public.organizations is 'Organización raíz (Mora Gastronomía).';

-- 3.2 Espacios / unidades de negocio -----------------------------------
create table public.business_spaces (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete restrict,
  name             text not null check (length(btrim(name)) > 0),
  slug             text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description      text,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint business_spaces_org_slug_key unique (organization_id, slug),
  constraint business_spaces_id_org_key  unique (id, organization_id)   -- destino de FK compuesta
);
comment on table public.business_spaces is
  'Unidades de negocio (Balcarce, Eventos, Copa, Hotel Catalinas). Un espacio inactivo = módulo no habilitado.';

-- 3.3 Empresas clientes -------------------------------------------------
create table public.companies (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  nombre_comercial   text not null check (length(btrim(nombre_comercial)) > 0),
  razon_social       text,
  cuit               text check (cuit is null or cuit ~ '^[0-9]{11}$'),
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint companies_id_space_key unique (id, business_space_id)       -- destino de FK compuesta
);
comment on table public.companies is 'Empresas clientes. Cada una pertenece a un business_space.';
comment on column public.companies.cuit is 'Solo dígitos (11). Único por espacio.';

-- 3.4 Perfiles (identidad) ---------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete restrict,
  dni         text not null check (dni ~ '^[0-9]{7,8}$'),
  nombre      text not null check (length(btrim(nombre)) > 0),
  apellido    text not null check (length(btrim(apellido)) > 0),
  email       text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  telefono    text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_dni_key unique (dni)
);
comment on table public.profiles is
  'Identidad única de la persona. PK = auth.users.id. Nunca se duplica por empresa; la relación laboral vive en memberships.';
comment on column public.profiles.dni is 'Identificador de acceso (login). Único. No es PK.';
comment on column public.profiles.email is 'Email de contacto (opcional). El email de auth.users es técnico/sintético.';

-- 3.5 Memberships (relación persona ↔ organización/espacio/empresa) -----
create table public.memberships (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete restrict,
  organization_id    uuid not null references public.organizations(id) on delete restrict,
  business_space_id  uuid,
  company_id         uuid,
  role               public.app_role not null,
  status             public.membership_status not null default 'ACTIVE',
  started_at         date not null default private.fn_today(),
  ended_at           date,
  notes              text,
  created_by         uuid references public.profiles(id) default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- el espacio pertenece a la organización
  constraint memberships_space_org_fkey
    foreign key (business_space_id, organization_id)
    references public.business_spaces(id, organization_id) on delete restrict,
  -- la empresa pertenece al espacio
  constraint memberships_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict,

  constraint memberships_dates_chk check (ended_at is null or ended_at >= started_at),
  constraint memberships_ended_requires_date_chk check (status <> 'ENDED' or ended_at is not null),

  -- combinaciones válidas rol ↔ alcance
  constraint memberships_scope_chk check (
       (role = 'ORG_ADMIN'   and business_space_id is null     and company_id is null)
    or (role = 'SPACE_ADMIN' and business_space_id is not null and company_id is null)
    or (role in ('COMPANY_ADMIN', 'EMPLOYEE')
                             and business_space_id is not null and company_id is not null)
  ),

  -- un empleado no puede tener dos memberships EMPLOYEE superpuestas en el mismo espacio
  constraint memberships_employee_no_overlap
    exclude using gist (
      user_id with =,
      business_space_id with =,
      daterange(started_at, ended_at, '[]') with &&
    ) where (role = 'EMPLOYEE')
);
comment on table public.memberships is
  'Historial de relaciones de una persona con Mora / un espacio / una empresa. Vigente = status ACTIVE y fecha dentro de [started_at, ended_at]. Nunca se borra.';
comment on column public.memberships.ended_at is 'Último día de pertenencia (inclusive). NULL = sin fin.';

-- 3.6 Catálogo: categorías ---------------------------------------------
create table public.gastronomic_categories (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  name               text not null check (length(btrim(name)) > 0),
  slug               text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description        text,
  sort_order         integer not null default 0,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint gastronomic_categories_space_slug_key unique (business_space_id, slug),
  constraint gastronomic_categories_id_space_key   unique (id, business_space_id)
);
comment on table public.gastronomic_categories is 'Catálogo global de categorías por espacio (Bandeja, Postre, Bebida, Pan...). No se duplica por empresa.';

-- 3.7 Catálogo: opciones ------------------------------------------------
create table public.gastronomic_options (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.gastronomic_categories(id) on delete restrict,
  name         text not null check (length(btrim(name)) > 0),
  description  text,
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint gastronomic_options_category_name_key unique (category_id, name),
  constraint gastronomic_options_id_category_key   unique (id, category_id)
);
comment on table public.gastronomic_options is 'Opciones del catálogo global. Se desactivan, no se borran.';

-- 3.8 Categorías habilitadas por empresa -------------------------------
create table public.company_gastronomic_categories (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  category_id        uuid not null,
  business_space_id  uuid not null,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint company_gastronomic_categories_key unique (company_id, category_id),
  constraint cgc_company_space_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict,
  constraint cgc_category_space_fkey
    foreign key (category_id, business_space_id)
    references public.gastronomic_categories(id, business_space_id) on delete restrict
);
comment on table public.company_gastronomic_categories is
  'Qué categorías del catálogo tiene contratadas cada empresa. Las FK compuestas garantizan que empresa y categoría sean del mismo espacio.';

-- 3.9 Calendario semanal -----------------------------------------------
create table public.calendar_weeks (
  id                 uuid primary key default gen_random_uuid(),
  business_space_id  uuid not null references public.business_spaces(id) on delete restrict,
  week_start         date not null,
  week_end           date not null,
  status             public.calendar_week_status not null default 'DRAFT',
  published_at       timestamptz,
  published_by       uuid references public.profiles(id),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint calendar_weeks_space_start_key unique (business_space_id, week_start),
  constraint calendar_weeks_id_space_key    unique (id, business_space_id),
  constraint calendar_weeks_monday_chk      check (extract(isodow from week_start) = 1),
  constraint calendar_weeks_range_chk       check (week_end between week_start and week_start + 6),
  constraint calendar_weeks_published_chk   check ((status = 'PUBLISHED') = (published_at is not null))
);
comment on table public.calendar_weeks is 'Semana planificada por el espacio. Empieza siempre en lunes. DRAFT → PUBLISHED.';

-- 3.10 Días de servicio --------------------------------------------------
create table public.calendar_days (
  id                 uuid primary key default gen_random_uuid(),
  calendar_week_id   uuid not null,
  business_space_id  uuid not null,
  service_date       date not null,
  is_service_day     boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint calendar_days_space_date_key unique (business_space_id, service_date),
  constraint calendar_days_id_space_key   unique (id, business_space_id),
  constraint calendar_days_week_fkey
    foreign key (calendar_week_id, business_space_id)
    references public.calendar_weeks(id, business_space_id) on delete restrict
);
comment on column public.calendar_days.is_service_day is 'false = feriado / sin servicio.';

-- 3.11 Disponibilidad diaria ---------------------------------------------
create table public.daily_availability (
  id                 uuid primary key default gen_random_uuid(),
  calendar_day_id    uuid not null,
  business_space_id  uuid not null,
  category_id        uuid not null,
  option_id          uuid not null,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint daily_availability_day_option_key unique (calendar_day_id, option_id),
  constraint daily_availability_day_fkey
    foreign key (calendar_day_id, business_space_id)
    references public.calendar_days(id, business_space_id) on delete restrict,
  constraint daily_availability_category_fkey
    foreign key (category_id, business_space_id)
    references public.gastronomic_categories(id, business_space_id) on delete restrict,
  constraint daily_availability_option_fkey
    foreign key (option_id, category_id)
    references public.gastronomic_options(id, category_id) on delete restrict
);
comment on table public.daily_availability is
  'Qué opciones del catálogo se ofrecen cada día. No modifica el catálogo global.';

-- 3.12 Elecciones del empleado (cabecera) -------------------------------
create table public.employee_selections (
  id                 uuid primary key default gen_random_uuid(),
  employee_id        uuid not null references public.profiles(id) on delete restrict,
  membership_id      uuid not null references public.memberships(id) on delete restrict,
  company_id         uuid not null,
  business_space_id  uuid not null,
  calendar_day_id    uuid not null,
  service_date       date not null,
  status             public.selection_status not null default 'SUBMITTED',
  submitted_at       timestamptz not null default now(),
  locked_at          timestamptz not null,
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint employee_selections_company_fkey
    foreign key (company_id, business_space_id)
    references public.companies(id, business_space_id) on delete restrict,
  constraint employee_selections_day_fkey
    foreign key (calendar_day_id, business_space_id)
    references public.calendar_days(id, business_space_id) on delete restrict,
  constraint employee_selections_cancel_chk check ((status = 'CANCELLED') = (cancelled_at is not null))
);
comment on table public.employee_selections is
  'Elección de un empleado para un día. company_id y membership_id quedan congelados (historial).';
comment on column public.employee_selections.locked_at is
  'Momento de cierre (12:00 del día anterior, hora Tucumán). Pasado este instante la elección es inmodificable.';
comment on column public.employee_selections.service_date is 'Copia de calendar_days.service_date (la setea el trigger) para reportes.';

-- 3.13 Ítems de la elección (uno por categoría) -------------------------
create table public.employee_selection_items (
  id            uuid primary key default gen_random_uuid(),
  selection_id  uuid not null references public.employee_selections(id) on delete restrict,
  category_id   uuid not null references public.gastronomic_categories(id) on delete restrict,
  option_id     uuid not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint employee_selection_items_one_per_category_key unique (selection_id, category_id),
  constraint employee_selection_items_option_fkey
    foreign key (option_id, category_id)
    references public.gastronomic_options(id, category_id) on delete restrict
);
comment on table public.employee_selection_items is 'Desglose por categoría: Bandeja → Milanesa, Postre → Flan...';

-- =====================================================================
-- 4. ÍNDICES
-- (Los UNIQUE ya crean índice: dni, slugs, (calendar_day_id, option_id),
--  (selection_id, category_id), etc. No se duplican acá.)
-- =====================================================================
create unique index companies_space_cuit_key
  on public.companies (business_space_id, cuit) where cuit is not null;
create index companies_space_idx on public.companies (business_space_id);

create index memberships_user_status_idx on public.memberships (user_id, status);
create index memberships_company_idx on public.memberships (company_id, role) where company_id is not null;
create index memberships_space_idx on public.memberships (business_space_id, role) where business_space_id is not null;
-- un admin no puede tener dos memberships abiertas idénticas
create unique index memberships_one_open_admin_per_scope_key
  on public.memberships (
    user_id, role, organization_id,
    coalesce(business_space_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(company_id,        '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where role <> 'EMPLOYEE' and status = 'ACTIVE' and ended_at is null;

create index cgc_category_idx on public.company_gastronomic_categories (category_id);

create index calendar_days_week_idx on public.calendar_days (calendar_week_id);

create index daily_availability_option_idx   on public.daily_availability (option_id);
create index daily_availability_category_idx on public.daily_availability (category_id);

create unique index employee_selections_one_active_per_day_key
  on public.employee_selections (employee_id, calendar_day_id) where status = 'SUBMITTED';
create index employee_selections_employee_date_idx on public.employee_selections (employee_id, service_date);
create index employee_selections_company_date_idx  on public.employee_selections (company_id, service_date);
create index employee_selections_space_date_idx    on public.employee_selections (business_space_id, service_date);
create index employee_selections_day_idx           on public.employee_selections (calendar_day_id);
create index employee_selections_membership_idx    on public.employee_selections (membership_id);

create index employee_selection_items_option_idx   on public.employee_selection_items (option_id);
create index employee_selection_items_category_idx on public.employee_selection_items (category_id);

-- =====================================================================
-- 5. FUNCIONES AUXILIARES (private)
-- Todas SECURITY DEFINER + search_path vacío: leen memberships sin pasar
-- por RLS, lo que evita recursión en las políticas.
-- =====================================================================

-- 5.1 Vigencia de una membership en una fecha
create or replace function private.is_current_membership(
  p_status public.membership_status, p_started date, p_ended date, p_on date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status = 'ACTIVE' and p_started <= p_on and (p_ended is null or p_ended >= p_on);
$$;

-- 5.2 ¿El usuario actual tiene perfil activo?
create or replace function private.user_is_active()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.activo);
$$;

-- 5.3 ¿Tiene alguna membership vigente hoy? (opcionalmente de un rol)
create or replace function private.has_active_membership(p_role public.app_role default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_is_active() and exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and (p_role is null or m.role = p_role)
      and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today()));
$$;

-- 5.4 Admin de organización
create or replace function private.is_org_admin(p_organization_id uuid default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_is_active() and exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.role = 'ORG_ADMIN'
      and (p_organization_id is null or m.organization_id = p_organization_id)
      and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today()));
$$;

-- 5.5 Admin de un espacio (solo si el espacio está activo = módulo habilitado)
create or replace function private.is_space_admin(p_business_space_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_is_active() and exists (
    select 1 from public.memberships m
    join public.business_spaces s on s.id = m.business_space_id and s.active
    where m.user_id = (select auth.uid())
      and m.role = 'SPACE_ADMIN'
      and m.business_space_id = p_business_space_id
      and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today()));
$$;

-- 5.6 Acceso administrativo a un espacio (admin org dueña o admin del espacio)
create or replace function private.has_space_access(p_business_space_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
           select 1 from public.business_spaces s
           where s.id = p_business_space_id and private.is_org_admin(s.organization_id))
      or private.is_space_admin(p_business_space_id);
$$;

-- 5.7 Lectura de un espacio (admins + cualquier miembro vigente o futuro)
create or replace function private.can_read_space(p_business_space_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_space_access(p_business_space_id)
      or (private.user_is_active() and exists (
            select 1 from public.memberships m
            join public.business_spaces s on s.id = m.business_space_id and s.active
            where m.user_id = (select auth.uid())
              and m.business_space_id = p_business_space_id
              and m.status = 'ACTIVE'
              and (m.ended_at is null or m.ended_at >= private.fn_today())));
$$;

-- 5.8 Admin de empresa
create or replace function private.is_company_admin(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_is_active() and exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.role = 'COMPANY_ADMIN'
      and m.company_id = p_company_id
      and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today()));
$$;

-- 5.9 Gestión de una empresa (admin org/espacio o admin de esa empresa)
create or replace function private.can_manage_company(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
           select 1 from public.companies c
           where c.id = p_company_id and private.has_space_access(c.business_space_id))
      or private.is_company_admin(p_company_id);
$$;

-- 5.10 Lectura de una empresa (gestores + personas que pertenecen/pertenecieron)
create or replace function private.can_view_company(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.can_manage_company(p_company_id)
      or (private.user_is_active() and exists (
            select 1 from public.memberships m
            where m.user_id = (select auth.uid()) and m.company_id = p_company_id));
$$;

-- 5.11 ¿Algún rol administrativo vigente?
create or replace function private.is_any_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_is_active() and exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.role in ('ORG_ADMIN', 'SPACE_ADMIN', 'COMPANY_ADMIN')
      and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today()));
$$;

-- 5.12 Gestión de un perfil ajeno (ver / editar datos básicos)
create or replace function private.can_manage_profile(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_org_admin(null)
      or exists (
           select 1 from public.memberships m
           where m.user_id = p_user_id
             and m.business_space_id is not null
             and private.is_space_admin(m.business_space_id))
      or exists (
           select 1 from public.memberships m
           where m.user_id = p_user_id
             and m.company_id is not null
             and m.status = 'ACTIVE'
             and (m.ended_at is null or m.ended_at >= private.fn_today())
             and private.is_company_admin(m.company_id));
$$;

-- 5.13 Cambios de identidad (DNI / activo): solo admin org o admin de espacio
create or replace function private.can_admin_profile_identity(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_org_admin(null)
      or exists (
           select 1 from public.memberships m
           where m.user_id = p_user_id
             and m.business_space_id is not null
             and private.is_space_admin(m.business_space_id));
$$;

-- 5.14 Cierre de la ventana de elección (12:00 del día anterior, Tucumán)
create or replace function private.selection_deadline(p_service_date date)
returns timestamptz
language sql stable set search_path = ''
as $$
  select ((p_service_date - 1)::timestamp + time '12:00') at time zone 'America/Argentina/Tucuman';
$$;
comment on function private.selection_deadline(date) is
  'Regla de cierre. Para cambiarla (ej. último día hábil) se modifica SOLO esta función.';

create or replace function private.is_within_selection_window(p_service_date date)
returns boolean
language sql stable set search_path = ''
as $$
  select private.fn_now() < private.selection_deadline(p_service_date);
$$;

-- 5.15 ¿La opción está disponible ese día (semana publicada, todo activo)?
create or replace function private.is_option_available(p_calendar_day_id uuid, p_option_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.daily_availability a
    join public.calendar_days d          on d.id = a.calendar_day_id and d.is_service_day
    join public.calendar_weeks w         on w.id = d.calendar_week_id and w.status = 'PUBLISHED'
    join public.gastronomic_options o    on o.id = a.option_id and o.active
    join public.gastronomic_categories c on c.id = a.category_id and c.active
    where a.calendar_day_id = p_calendar_day_id
      and a.option_id = p_option_id);
$$;

-- 5.16 ¿La categoría está habilitada para la empresa?
create or replace function private.is_category_enabled_for_company(p_company_id uuid, p_category_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.company_gastronomic_categories cgc
    join public.companies co              on co.id = cgc.company_id and co.active
    join public.gastronomic_categories c  on c.id = cgc.category_id and c.active
    where cgc.company_id = p_company_id
      and cgc.category_id = p_category_id
      and cgc.active);
$$;

-- 5.17 Membership EMPLOYEE vigente para (persona, empresa, fecha)
create or replace function private.employee_membership_on(p_user_id uuid, p_company_id uuid, p_on date)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id
  from public.memberships m
  join public.profiles p on p.id = m.user_id and p.activo
  where m.user_id = p_user_id
    and m.company_id = p_company_id
    and m.role = 'EMPLOYEE'
    and private.is_current_membership(m.status, m.started_at, m.ended_at, p_on)
  limit 1;
$$;

-- 5.18 Empresa del usuario actual para un día de calendario
create or replace function private.my_employee_company_for_day(p_calendar_day_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.company_id
  from public.calendar_days d
  join public.memberships m
    on m.business_space_id = d.business_space_id
   and m.user_id = (select auth.uid())
   and m.role = 'EMPLOYEE'
   and private.is_current_membership(m.status, m.started_at, m.ended_at, d.service_date)
  where d.id = p_calendar_day_id
  limit 1;
$$;

-- 5.19 Helpers de lectura para RLS
create or replace function private.is_week_published(p_calendar_week_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.calendar_weeks w where w.id = p_calendar_week_id and w.status = 'PUBLISHED');
$$;

create or replace function private.category_space(p_category_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.business_space_id from public.gastronomic_categories c where c.id = p_category_id;
$$;

-- Disponibilidad visible para empleados/admins de empresa: semana publicada,
-- membership vigente en la FECHA DEL SERVICIO y categoría habilitada para su empresa.
create or replace function private.can_view_availability(p_calendar_day_id uuid, p_category_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_is_active() and exists (
    select 1
    from public.calendar_days d
    join public.calendar_weeks w on w.id = d.calendar_week_id and w.status = 'PUBLISHED'
    join public.memberships m
      on m.business_space_id = d.business_space_id
     and m.user_id = (select auth.uid())
     and m.role in ('EMPLOYEE', 'COMPANY_ADMIN')
     and private.is_current_membership(m.status, m.started_at, m.ended_at, d.service_date)
    join public.company_gastronomic_categories cgc
      on cgc.company_id = m.company_id and cgc.category_id = p_category_id and cgc.active
    where d.id = p_calendar_day_id);
$$;

create or replace function private.can_view_selection(p_selection_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.employee_selections s
    where s.id = p_selection_id
      and (s.employee_id = (select auth.uid()) or private.can_manage_company(s.company_id)));
$$;

create or replace function private.owns_selection(p_selection_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.employee_selections s
    where s.id = p_selection_id and s.employee_id = (select auth.uid()));
$$;

-- 5.20 Cierre de membership + cancelación de elecciones futuras abiertas
-- (uso interno: NO ejecutable por authenticated; ver sección 10)
create or replace function private.close_membership(p_membership_id uuid, p_ended_at date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.memberships%rowtype;
begin
  select * into v_m from public.memberships where id = p_membership_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_NOT_FOUND';
  end if;
  if p_ended_at < v_m.started_at then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_CONFLICT',
      detail = 'La fecha de baja es anterior al inicio de la membership.';
  end if;

  update public.memberships
     set ended_at = p_ended_at,
         status   = case when p_ended_at < private.fn_today()
                         then 'ENDED'::public.membership_status else status end
   where id = p_membership_id;

  -- elecciones posteriores a la baja y todavía abiertas: se cancelan.
  -- Las ya cerradas se conservan (producción comprometida, historial).
  update public.employee_selections
     set status = 'CANCELLED'
   where membership_id = p_membership_id
     and status = 'SUBMITTED'
     and service_date > p_ended_at
     and private.fn_now() < locked_at;
end;
$$;

-- =====================================================================
-- 6. TRIGGERS
-- =====================================================================

-- 6.1 updated_at genérico
create or replace function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.organizations                 for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.business_spaces               for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.companies                     for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.profiles                      for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.memberships                   for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.gastronomic_categories        for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.gastronomic_options           for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.company_gastronomic_categories for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.calendar_weeks                for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.calendar_days                 for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.daily_availability            for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.employee_selections           for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.employee_selection_items      for each row execute function private.set_updated_at();

-- 6.2 Alta automática de profile al crear el usuario en Supabase Auth
-- El backend crea el usuario con: auth.admin.createUser({ email: '<dni>@<dominio-login>',
--   password, email_confirm: true, user_metadata: { dni, nombre, apellido, telefono?, email_contacto? } })
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_dni      text  := nullif(regexp_replace(coalesce(v_meta ->> 'dni', ''), '[^0-9]', '', 'g'), '');
  v_nombre   text  := nullif(btrim(v_meta ->> 'nombre'), '');
  v_apellido text  := nullif(btrim(v_meta ->> 'apellido'), '');
begin
  if v_dni is null then
    return new;  -- cuentas técnicas sin DNI no generan perfil
  end if;
  if v_nombre is null or v_apellido is null then
    raise exception using errcode = 'P0001', message = 'PROFILE_DATA_REQUIRED',
      detail = 'user_metadata debe incluir dni, nombre y apellido.';
  end if;
  if exists (select 1 from public.profiles p where p.dni = v_dni) then
    raise exception using errcode = '23505', message = 'DNI_ALREADY_REGISTERED',
      detail = format('Ya existe una identidad con DNI %s. No crear otro usuario: incorporarla con add_company_member().', v_dni);
  end if;

  insert into public.profiles (id, dni, nombre, apellido, email, telefono)
  values (new.id, v_dni, v_nombre, v_apellido,
          nullif(btrim(v_meta ->> 'email_contacto'), ''),
          nullif(btrim(v_meta ->> 'telefono'), ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_mora on auth.users;
create trigger on_auth_user_created_mora
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- 6.3 Protección de campos sensibles del perfil
create or replace function private.trg_profiles_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;  -- service_role / SQL directo
  end if;
  if new.id <> old.id then
    raise exception using errcode = 'P0001', message = 'IMMUTABLE_FIELDS';
  end if;
  if (new.dni is distinct from old.dni or new.activo is distinct from old.activo)
     and not private.can_admin_profile_identity(old.id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN',
      detail = 'Solo un admin de Mora o del espacio puede cambiar DNI o estado.';
  end if;
  if (new.nombre is distinct from old.nombre or new.apellido is distinct from old.apellido)
     and not private.can_manage_profile(old.id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN',
      detail = 'Nombre y apellido los modifica un administrador.';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function private.trg_profiles_guard();

-- 6.4 Validación de memberships
create or replace function private.trg_memberships_validate()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id
       or new.organization_id <> old.organization_id
       or new.role <> old.role
       or new.business_space_id is distinct from old.business_space_id
       or new.company_id is distinct from old.company_id then
      raise exception using errcode = 'P0001', message = 'IMMUTABLE_FIELDS',
        detail = 'Persona, rol y alcance no se modifican: cerrar la membership y crear una nueva.';
    end if;
  else
    if not exists (select 1 from public.profiles p where p.id = new.user_id and p.activo) then
      raise exception using errcode = 'P0001', message = 'PROFILE_INACTIVE';
    end if;
    if new.company_id is not null
       and not exists (select 1 from public.companies c where c.id = new.company_id and c.active) then
      raise exception using errcode = 'P0001', message = 'COMPANY_INACTIVE';
    end if;
    if new.business_space_id is not null
       and not exists (select 1 from public.business_spaces s where s.id = new.business_space_id and s.active) then
      raise exception using errcode = 'P0001', message = 'SPACE_INACTIVE';
    end if;
  end if;

  if new.status = 'ENDED' and new.ended_at is null then
    new.ended_at := greatest(new.started_at, private.fn_today() - 1);
  end if;
  return new;
end;
$$;

create trigger memberships_validate before insert or update on public.memberships
  for each row execute function private.trg_memberships_validate();

-- 6.5 Semanas: publicación y protección
create or replace function private.trg_calendar_weeks_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'PUBLISHED' then
      raise exception using errcode = 'P0001', message = 'WEEK_WITHOUT_MENU',
        detail = 'Crear la semana en DRAFT, cargar días y disponibilidad, y luego publicar.';
    end if;
    new.published_at := null;
    new.published_by := null;
    return new;
  end if;

  if (new.week_start <> old.week_start or new.week_end <> old.week_end
      or new.business_space_id <> old.business_space_id)
     and exists (select 1 from public.calendar_days d where d.calendar_week_id = old.id) then
    raise exception using errcode = 'P0001', message = 'WEEK_HAS_DAYS';
  end if;

  if new.status = 'PUBLISHED' and old.status = 'DRAFT' then
    if not exists (
      select 1 from public.calendar_days d
      join public.daily_availability a on a.calendar_day_id = d.id
      where d.calendar_week_id = new.id and d.is_service_day) then
      raise exception using errcode = 'P0001', message = 'WEEK_WITHOUT_MENU';
    end if;
    new.published_at := now();
    new.published_by := (select auth.uid());
  elsif new.status = 'DRAFT' and old.status = 'PUBLISHED' then
    if exists (
      select 1 from public.employee_selections s
      join public.calendar_days d on d.id = s.calendar_day_id
      where d.calendar_week_id = old.id and s.status = 'SUBMITTED') then
      raise exception using errcode = 'P0001', message = 'WEEK_HAS_SELECTIONS',
        detail = 'No se puede despublicar una semana con elecciones registradas.';
    end if;
    new.published_at := null;
    new.published_by := null;
  else
    new.published_at := old.published_at;
    new.published_by := old.published_by;
  end if;
  return new;
end;
$$;

create trigger calendar_weeks_guard before insert or update on public.calendar_weeks
  for each row execute function private.trg_calendar_weeks_guard();

-- 6.6 Días: dentro de la semana y protegidos si tienen elecciones
create or replace function private.trg_calendar_days_validate()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_start date;
  v_end   date;
begin
  select w.week_start, w.week_end into v_start, v_end
  from public.calendar_weeks w where w.id = new.calendar_week_id;

  if new.service_date < v_start or new.service_date > v_end then
    raise exception using errcode = 'P0001', message = 'DATE_OUTSIDE_WEEK';
  end if;

  if tg_op = 'UPDATE'
     and (new.service_date <> old.service_date
          or new.calendar_week_id <> old.calendar_week_id
          or (old.is_service_day and not new.is_service_day))
     and exists (select 1 from public.employee_selections s
                 where s.calendar_day_id = old.id and s.status = 'SUBMITTED') then
    raise exception using errcode = 'P0001', message = 'DAY_HAS_SELECTIONS';
  end if;
  return new;
end;
$$;

create trigger calendar_days_validate before insert or update on public.calendar_days
  for each row execute function private.trg_calendar_days_validate();

-- 6.7 Disponibilidad: solo opciones activas; no quitar opciones ya elegidas
create or replace function private.trg_daily_availability_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_check_old boolean := false;
begin
  if tg_op = 'DELETE' then
    v_check_old := true;
  elsif tg_op = 'UPDATE' then
    v_check_old := (new.option_id <> old.option_id or new.calendar_day_id <> old.calendar_day_id);
  end if;

  if v_check_old and exists (
      select 1 from public.employee_selection_items i
      join public.employee_selections s on s.id = i.selection_id
      where s.calendar_day_id = old.calendar_day_id
        and s.status = 'SUBMITTED'
        and i.option_id = old.option_id) then
    raise exception using errcode = 'P0001', message = 'OPTION_HAS_SELECTIONS',
      detail = 'Hay empleados que ya eligieron esta opción para ese día.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if (tg_op = 'INSERT' or new.option_id <> old.option_id)
     and not exists (
       select 1 from public.gastronomic_options o
       join public.gastronomic_categories c on c.id = o.category_id
       where o.id = new.option_id and o.active and c.active) then
    raise exception using errcode = 'P0001', message = 'OPTION_INACTIVE';
  end if;
  return new;
end;
$$;

create trigger daily_availability_guard before insert or update or delete on public.daily_availability
  for each row execute function private.trg_daily_availability_guard();

-- 6.8 Elecciones: calendario publicado, membership, ventana de cierre, inmutabilidad
create or replace function private.trg_employee_selections_validate()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_now            timestamptz := private.fn_now();
  v_service_date   date;
  v_space          uuid;
  v_is_service_day boolean;
  v_week_status    public.calendar_week_status;
  v_membership     uuid;
begin
  if tg_op = 'INSERT' then
    select d.service_date, d.business_space_id, d.is_service_day, w.status
      into v_service_date, v_space, v_is_service_day, v_week_status
    from public.calendar_days d
    join public.calendar_weeks w on w.id = d.calendar_week_id
    where d.id = new.calendar_day_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'CALENDAR_DAY_NOT_FOUND';
    end if;
    if v_week_status <> 'PUBLISHED' then
      raise exception using errcode = 'P0001', message = 'WEEK_NOT_PUBLISHED';
    end if;
    if not v_is_service_day then
      raise exception using errcode = 'P0001', message = 'NOT_A_SERVICE_DAY';
    end if;

    new.service_date      := v_service_date;
    new.business_space_id := v_space;

    if not exists (select 1 from public.companies c
                   where c.id = new.company_id and c.business_space_id = v_space and c.active) then
      raise exception using errcode = 'P0001', message = 'COMPANY_NOT_AVAILABLE';
    end if;

    v_membership := private.employee_membership_on(new.employee_id, new.company_id, new.service_date);
    if v_membership is null then
      raise exception using errcode = 'P0001', message = 'NO_ACTIVE_MEMBERSHIP',
        detail = 'El empleado no pertenece a esa empresa en la fecha del servicio.';
    end if;
    new.membership_id := v_membership;

    new.locked_at := private.selection_deadline(new.service_date);
    if v_now >= new.locked_at then
      raise exception using errcode = 'P0001', message = 'SELECTION_WINDOW_CLOSED',
        detail = format('La elección para el %s cerró el %s.', new.service_date,
                        to_char(new.locked_at at time zone 'America/Argentina/Tucuman', 'DD/MM/YYYY HH24:MI'));
    end if;

    new.status       := 'SUBMITTED';
    new.submitted_at := v_now;
    new.cancelled_at := null;
    return new;
  end if;

  -- UPDATE
  if new.employee_id <> old.employee_id
     or new.company_id <> old.company_id
     or new.calendar_day_id <> old.calendar_day_id
     or new.service_date <> old.service_date
     or new.business_space_id <> old.business_space_id
     or new.membership_id <> old.membership_id
     or new.locked_at <> old.locked_at then
    raise exception using errcode = 'P0001', message = 'IMMUTABLE_FIELDS';
  end if;
  if v_now >= old.locked_at then
    raise exception using errcode = 'P0001', message = 'SELECTION_LOCKED',
      detail = 'La elección ya está cerrada y no puede modificarse.';
  end if;
  if old.status = 'CANCELLED' then
    raise exception using errcode = 'P0001', message = 'SELECTION_CANCELLED';
  end if;

  if new.status = 'CANCELLED' then
    new.cancelled_at := v_now;
  else
    new.submitted_at := v_now;
  end if;
  return new;
end;
$$;

create trigger employee_selections_validate before insert or update on public.employee_selections
  for each row execute function private.trg_employee_selections_validate();

-- 6.9 Ítems: categoría habilitada, opción activa y disponible, ventana abierta
create or replace function private.trg_selection_items_validate()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_selection_id uuid;
  v_status       public.selection_status;
  v_locked_at    timestamptz;
  v_company_id   uuid;
  v_day_id       uuid;
  v_opt_active   boolean;
  v_cat_active   boolean;
begin
  if tg_op = 'DELETE' then
    v_selection_id := old.selection_id;
  else
    v_selection_id := new.selection_id;
  end if;

  select s.status, s.locked_at, s.company_id, s.calendar_day_id
    into v_status, v_locked_at, v_company_id, v_day_id
  from public.employee_selections s where s.id = v_selection_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'SELECTION_NOT_FOUND';
  end if;
  if v_status <> 'SUBMITTED' then
    raise exception using errcode = 'P0001', message = 'SELECTION_CANCELLED';
  end if;
  if private.fn_now() >= v_locked_at then
    raise exception using errcode = 'P0001', message = 'SELECTION_LOCKED',
      detail = 'La elección ya está cerrada y no puede modificarse.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' and new.selection_id <> old.selection_id then
    raise exception using errcode = 'P0001', message = 'IMMUTABLE_FIELDS';
  end if;

  if not private.is_category_enabled_for_company(v_company_id, new.category_id) then
    raise exception using errcode = 'P0001', message = 'CATEGORY_NOT_ENABLED',
      detail = 'La categoría no está habilitada para la empresa.';
  end if;

  select o.active, c.active into v_opt_active, v_cat_active
  from public.gastronomic_options o
  join public.gastronomic_categories c on c.id = o.category_id
  where o.id = new.option_id and o.category_id = new.category_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'OPTION_CATEGORY_MISMATCH';
  end if;
  if not (v_opt_active and v_cat_active) then
    raise exception using errcode = 'P0001', message = 'OPTION_INACTIVE';
  end if;
  if not private.is_option_available(v_day_id, new.option_id) then
    raise exception using errcode = 'P0001', message = 'OPTION_NOT_AVAILABLE',
      detail = 'La opción no está disponible para ese día.';
  end if;
  return new;
end;
$$;

create trigger selection_items_validate before insert or update or delete on public.employee_selection_items
  for each row execute function private.trg_selection_items_validate();

-- =====================================================================
-- 7. ROW LEVEL SECURITY
-- Sin política = denegado. No hay políticas DELETE salvo donde se indica:
-- el historial se preserva con flags active/status.
-- =====================================================================
alter table public.organizations                  enable row level security;
alter table public.business_spaces                enable row level security;
alter table public.companies                      enable row level security;
alter table public.profiles                       enable row level security;
alter table public.memberships                    enable row level security;
alter table public.gastronomic_categories         enable row level security;
alter table public.gastronomic_options            enable row level security;
alter table public.company_gastronomic_categories enable row level security;
alter table public.calendar_weeks                 enable row level security;
alter table public.calendar_days                  enable row level security;
alter table public.daily_availability             enable row level security;
alter table public.employee_selections            enable row level security;
alter table public.employee_selection_items       enable row level security;

-- organizations
create policy organizations_select on public.organizations for select to authenticated
  using (
    private.is_org_admin(id)
    or exists (select 1 from public.memberships m
               where m.organization_id = organizations.id
                 and m.user_id = (select auth.uid())
                 and m.status = 'ACTIVE'
                 and (m.ended_at is null or m.ended_at >= private.fn_today()))
  );
create policy organizations_update on public.organizations for update to authenticated
  using (private.is_org_admin(id)) with check (private.is_org_admin(id));

-- business_spaces
create policy business_spaces_select on public.business_spaces for select to authenticated
  using (private.can_read_space(id));
create policy business_spaces_insert on public.business_spaces for insert to authenticated
  with check (private.is_org_admin(organization_id));
create policy business_spaces_update on public.business_spaces for update to authenticated
  using (private.is_org_admin(organization_id)) with check (private.is_org_admin(organization_id));

-- companies
create policy companies_select on public.companies for select to authenticated
  using (private.can_view_company(id));
create policy companies_insert on public.companies for insert to authenticated
  with check (private.has_space_access(business_space_id));
create policy companies_update on public.companies for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));

-- profiles (el alta la hace el trigger de auth; no hay INSERT para usuarios)
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.can_manage_profile(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.can_manage_profile(id))
  with check (id = (select auth.uid()) or private.can_manage_profile(id));

-- memberships
create policy memberships_select on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_org_admin(organization_id)
    or (business_space_id is not null and private.is_space_admin(business_space_id))
    or (company_id is not null and private.is_company_admin(company_id))
  );
create policy memberships_insert on public.memberships for insert to authenticated
  with check (
    private.is_org_admin(organization_id)
    or (role in ('COMPANY_ADMIN', 'EMPLOYEE') and private.is_space_admin(business_space_id))
    or (role = 'EMPLOYEE' and private.is_company_admin(company_id))
  );
create policy memberships_update on public.memberships for update to authenticated
  using (
    private.is_org_admin(organization_id)
    or (role in ('COMPANY_ADMIN', 'EMPLOYEE') and private.is_space_admin(business_space_id))
    or (role = 'EMPLOYEE' and private.is_company_admin(company_id))
  )
  with check (
    private.is_org_admin(organization_id)
    or (role in ('COMPANY_ADMIN', 'EMPLOYEE') and private.is_space_admin(business_space_id))
    or (role = 'EMPLOYEE' and private.is_company_admin(company_id))
  );

-- gastronomic_categories
create policy gastronomic_categories_select on public.gastronomic_categories for select to authenticated
  using (private.can_read_space(business_space_id));
create policy gastronomic_categories_insert on public.gastronomic_categories for insert to authenticated
  with check (private.has_space_access(business_space_id));
create policy gastronomic_categories_update on public.gastronomic_categories for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));

-- gastronomic_options
create policy gastronomic_options_select on public.gastronomic_options for select to authenticated
  using (private.can_read_space(private.category_space(category_id)));
create policy gastronomic_options_insert on public.gastronomic_options for insert to authenticated
  with check (private.has_space_access(private.category_space(category_id)));
create policy gastronomic_options_update on public.gastronomic_options for update to authenticated
  using (private.has_space_access(private.category_space(category_id)))
  with check (private.has_space_access(private.category_space(category_id)));

-- company_gastronomic_categories (contratación: la define Balcarce/Mora)
create policy cgc_select on public.company_gastronomic_categories for select to authenticated
  using (private.can_view_company(company_id));
create policy cgc_insert on public.company_gastronomic_categories for insert to authenticated
  with check (private.has_space_access(business_space_id));
create policy cgc_update on public.company_gastronomic_categories for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));

-- calendar_weeks
create policy calendar_weeks_select on public.calendar_weeks for select to authenticated
  using (private.has_space_access(business_space_id)
         or (status = 'PUBLISHED' and private.can_read_space(business_space_id)));
create policy calendar_weeks_insert on public.calendar_weeks for insert to authenticated
  with check (private.has_space_access(business_space_id));
create policy calendar_weeks_update on public.calendar_weeks for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy calendar_weeks_delete_draft on public.calendar_weeks for delete to authenticated
  using (status = 'DRAFT' and private.has_space_access(business_space_id));

-- calendar_days
create policy calendar_days_select on public.calendar_days for select to authenticated
  using (private.has_space_access(business_space_id)
         or (private.is_week_published(calendar_week_id) and private.can_read_space(business_space_id)));
create policy calendar_days_insert on public.calendar_days for insert to authenticated
  with check (private.has_space_access(business_space_id));
create policy calendar_days_update on public.calendar_days for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy calendar_days_delete on public.calendar_days for delete to authenticated
  using (private.has_space_access(business_space_id));  -- FK RESTRICT impide borrar días con elecciones

-- daily_availability
create policy daily_availability_select on public.daily_availability for select to authenticated
  using (private.has_space_access(business_space_id)
         or private.can_view_availability(calendar_day_id, category_id));
create policy daily_availability_insert on public.daily_availability for insert to authenticated
  with check (private.has_space_access(business_space_id));
create policy daily_availability_update on public.daily_availability for update to authenticated
  using (private.has_space_access(business_space_id))
  with check (private.has_space_access(business_space_id));
create policy daily_availability_delete on public.daily_availability for delete to authenticated
  using (private.has_space_access(business_space_id));  -- trigger impide borrar opciones ya elegidas

-- employee_selections
create policy employee_selections_select on public.employee_selections for select to authenticated
  using (employee_id = (select auth.uid()) or private.can_manage_company(company_id));
create policy employee_selections_insert on public.employee_selections for insert to authenticated
  with check (employee_id = (select auth.uid()) and private.user_is_active());
create policy employee_selections_update on public.employee_selections for update to authenticated
  using (employee_id = (select auth.uid()))
  with check (employee_id = (select auth.uid()));

-- employee_selection_items
create policy employee_selection_items_select on public.employee_selection_items for select to authenticated
  using (private.can_view_selection(selection_id));
create policy employee_selection_items_insert on public.employee_selection_items for insert to authenticated
  with check (private.owns_selection(selection_id));
create policy employee_selection_items_update on public.employee_selection_items for update to authenticated
  using (private.owns_selection(selection_id))
  with check (private.owns_selection(selection_id));
create policy employee_selection_items_delete on public.employee_selection_items for delete to authenticated
  using (private.owns_selection(selection_id));  -- el trigger exige ventana abierta

-- =====================================================================
-- 8. VISTAS DE REPORTE (security_invoker: respetan la RLS del que consulta)
-- =====================================================================
create view public.v_selection_details
with (security_invoker = true) as
select
  s.id                  as selection_id,
  s.business_space_id,
  s.service_date,
  s.company_id,
  co.nombre_comercial   as company_name,
  s.employee_id,
  p.dni,
  p.nombre,
  p.apellido,
  s.status,
  s.submitted_at,
  s.locked_at,
  (private.fn_now() >= s.locked_at) as is_locked,
  i.category_id,
  c.name                as category_name,
  c.sort_order          as category_sort_order,
  i.option_id,
  o.name                as option_name
from public.employee_selections s
left join public.companies co                on co.id = s.company_id
left join public.profiles p                  on p.id = s.employee_id
left join public.employee_selection_items i  on i.selection_id = s.id
left join public.gastronomic_categories c    on c.id = i.category_id
left join public.gastronomic_options o       on o.id = i.option_id;

create view public.v_daily_option_totals
with (security_invoker = true) as
select
  s.business_space_id,
  s.service_date,
  i.category_id,
  c.name        as category_name,
  c.sort_order  as category_sort_order,
  i.option_id,
  o.name        as option_name,
  count(*)::integer as total
from public.employee_selections s
join public.employee_selection_items i on i.selection_id = s.id
join public.gastronomic_categories c   on c.id = i.category_id
join public.gastronomic_options o      on o.id = i.option_id
where s.status = 'SUBMITTED'
group by s.business_space_id, s.service_date, i.category_id, c.name, c.sort_order, i.option_id, o.name;

create view public.v_daily_company_option_totals
with (security_invoker = true) as
select
  s.business_space_id,
  s.service_date,
  s.company_id,
  co.nombre_comercial as company_name,
  i.category_id,
  c.name              as category_name,
  c.sort_order        as category_sort_order,
  i.option_id,
  o.name              as option_name,
  count(*)::integer   as total
from public.employee_selections s
join public.companies co               on co.id = s.company_id
join public.employee_selection_items i on i.selection_id = s.id
join public.gastronomic_categories c   on c.id = i.category_id
join public.gastronomic_options o      on o.id = i.option_id
where s.status = 'SUBMITTED'
group by s.business_space_id, s.service_date, s.company_id, co.nombre_comercial,
         i.category_id, c.name, c.sort_order, i.option_id, o.name;

create view public.v_daily_company_totals
with (security_invoker = true) as
select
  s.business_space_id,
  s.service_date,
  s.company_id,
  co.nombre_comercial as company_name,
  count(*)::integer   as total_viandas
from public.employee_selections s
join public.companies co on co.id = s.company_id
where s.status = 'SUBMITTED'
group by s.business_space_id, s.service_date, s.company_id, co.nombre_comercial;

comment on view public.v_daily_company_totals is 'Una vianda = una elección SUBMITTED (independiente de cuántas categorías tenga).';

-- =====================================================================
-- 9. RPCs PÚBLICAS (llamar desde Next.js con supabase.rpc)
-- =====================================================================

-- 9.1 Roles vigentes del usuario actual
create or replace function public.get_my_roles()
returns table (
  membership_id uuid, role public.app_role, organization_id uuid,
  business_space_id uuid, company_id uuid, started_at date, ended_at date)
language sql stable security invoker set search_path = ''
as $$
  select m.id, m.role, m.organization_id, m.business_space_id, m.company_id, m.started_at, m.ended_at
  from public.memberships m
  where m.user_id = (select auth.uid())
    and private.user_is_active()
    and private.is_current_membership(m.status, m.started_at, m.ended_at, private.fn_today())
  order by m.role, m.started_at;
$$;

-- 9.2 Menú del empleado para una fecha (empresa vigente en ESA fecha,
--     categorías habilitadas, opciones disponibles y activas)
create or replace function public.get_my_menu(p_service_date date)
returns table (
  calendar_day_id uuid, service_date date, company_id uuid, company_name text,
  category_id uuid, category_name text, category_sort_order integer,
  option_id uuid, option_name text, option_sort_order integer,
  deadline timestamptz, window_open boolean, is_selected boolean)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.service_date, co.id, co.nombre_comercial,
         c.id, c.name, c.sort_order,
         o.id, o.name, o.sort_order,
         private.selection_deadline(d.service_date),
         private.is_within_selection_window(d.service_date),
         exists (select 1
                 from public.employee_selections s
                 join public.employee_selection_items i on i.selection_id = s.id
                 where s.employee_id = (select auth.uid())
                   and s.calendar_day_id = d.id
                   and s.status = 'SUBMITTED'
                   and i.option_id = o.id)
  from public.memberships m
  join public.profiles p on p.id = m.user_id and p.activo
  join public.companies co on co.id = m.company_id and co.active
  join public.calendar_days d
    on d.business_space_id = m.business_space_id
   and d.service_date = p_service_date
   and d.is_service_day
  join public.calendar_weeks w on w.id = d.calendar_week_id and w.status = 'PUBLISHED'
  join public.daily_availability a on a.calendar_day_id = d.id
  join public.gastronomic_categories c on c.id = a.category_id and c.active
  join public.company_gastronomic_categories cgc
    on cgc.company_id = co.id and cgc.category_id = c.id and cgc.active
  join public.gastronomic_options o on o.id = a.option_id and o.active
  where m.user_id = (select auth.uid())
    and m.role = 'EMPLOYEE'
    and private.is_current_membership(m.status, m.started_at, m.ended_at, p_service_date)
  order by c.sort_order, c.name, a.sort_order, o.sort_order, o.name;
$$;

-- 9.3 Guardar/modificar la elección del día (atómico).
-- p_items = [{"category_id": "...", "option_id": "..."}, ...]
-- SECURITY INVOKER: aplican RLS y todos los triggers de validación.
create or replace function public.save_my_selection(p_calendar_day_id uuid, p_items jsonb)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_company    uuid;
  v_selection  uuid;
  v_categories uuid[];
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_SELECTION',
      detail = 'Para anular la elección usar cancel_my_selection().';
  end if;

  v_company := private.my_employee_company_for_day(p_calendar_day_id);
  if v_company is null then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_MEMBERSHIP';
  end if;

  select s.id into v_selection
  from public.employee_selections s
  where s.employee_id = v_uid and s.calendar_day_id = p_calendar_day_id and s.status = 'SUBMITTED'
  for update;

  if v_selection is null then
    insert into public.employee_selections (employee_id, company_id, calendar_day_id)
    values (v_uid, v_company, p_calendar_day_id)
    returning id into v_selection;
  else
    update public.employee_selections set submitted_at = private.fn_now() where id = v_selection;
  end if;

  select array_agg((e ->> 'category_id')::uuid) into v_categories
  from jsonb_array_elements(p_items) e;

  delete from public.employee_selection_items
  where selection_id = v_selection and category_id <> all (v_categories);

  insert into public.employee_selection_items (selection_id, category_id, option_id)
  select v_selection, (e ->> 'category_id')::uuid, (e ->> 'option_id')::uuid
  from jsonb_array_elements(p_items) e
  on conflict (selection_id, category_id)
  do update set option_id = excluded.option_id
  where public.employee_selection_items.option_id is distinct from excluded.option_id;

  return v_selection;
end;
$$;

-- 9.4 Anular la elección (solo con ventana abierta)
create or replace function public.cancel_my_selection(p_selection_id uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.employee_selections
     set status = 'CANCELLED'
   where id = p_selection_id
     and employee_id = (select auth.uid())
     and status = 'SUBMITTED';
  if not found then
    raise exception using errcode = 'P0001', message = 'SELECTION_NOT_FOUND';
  end if;
end;
$$;

-- 9.5 Buscar identidad por DNI (solo administradores; datos mínimos)
create or replace function public.find_profile_by_dni(p_dni text)
returns table (profile_id uuid, nombre text, apellido text, activo boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_any_admin() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  return query
    select p.id, p.nombre, p.apellido, p.activo
    from public.profiles p
    where p.dni = regexp_replace(coalesce(p_dni, ''), '[^0-9]', '', 'g');
end;
$$;

-- 9.6 Incorporar una identidad EXISTENTE a una empresa (empleado o admin de empresa).
-- Si es EMPLOYEE y tiene otra membership EMPLOYEE en el mismo espacio, se cierra
-- el día anterior a p_started_at y se anulan sus elecciones futuras abiertas.
create or replace function public.add_company_member(
  p_company_id uuid,
  p_dni        text,
  p_role       public.app_role default 'EMPLOYEE',
  p_started_at date default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_start   date := coalesce(p_started_at, private.fn_today());
  v_company public.companies%rowtype;
  v_org     uuid;
  v_user    uuid;
  v_active  boolean;
  v_id      uuid;
  r         record;
begin
  if p_role not in ('EMPLOYEE', 'COMPANY_ADMIN') then
    raise exception using errcode = 'P0001', message = 'INVALID_ROLE';
  end if;

  select * into v_company from public.companies where id = p_company_id;
  if not found or not private.can_manage_company(p_company_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_role = 'COMPANY_ADMIN' and not private.has_space_access(v_company.business_space_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN',
      detail = 'Solo Mora o el admin del espacio designan administradores de empresa.';
  end if;
  if not v_company.active then
    raise exception using errcode = 'P0001', message = 'COMPANY_INACTIVE';
  end if;

  select s.organization_id into v_org from public.business_spaces s where s.id = v_company.business_space_id;

  select p.id, p.activo into v_user, v_active
  from public.profiles p
  where p.dni = regexp_replace(coalesce(p_dni, ''), '[^0-9]', '', 'g');
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND',
      detail = 'No existe identidad con ese DNI: crear primero el usuario en Supabase Auth.';
  end if;
  if not v_active then
    raise exception using errcode = 'P0001', message = 'PROFILE_INACTIVE';
  end if;

  if p_role = 'EMPLOYEE' then
    -- idempotente: ya es empleado vigente de esta empresa en esa fecha
    select m.id into v_id from public.memberships m
    where m.user_id = v_user and m.company_id = p_company_id and m.role = 'EMPLOYEE'
      and private.is_current_membership(m.status, m.started_at, m.ended_at, v_start);
    if v_id is not null then
      return v_id;
    end if;

    for r in
      select m.id, m.started_at from public.memberships m
      where m.user_id = v_user
        and m.business_space_id = v_company.business_space_id
        and m.role = 'EMPLOYEE'
        and (m.ended_at is null or m.ended_at >= v_start)
    loop
      if r.started_at >= v_start then
        raise exception using errcode = 'P0001', message = 'MEMBERSHIP_CONFLICT',
          detail = 'Existe otra membership que comienza en o después de esa fecha.';
      end if;
      perform private.close_membership(r.id, v_start - 1);
    end loop;
  else
    select m.id into v_id from public.memberships m
    where m.user_id = v_user and m.company_id = p_company_id and m.role = 'COMPANY_ADMIN'
      and m.status = 'ACTIVE' and m.ended_at is null;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.memberships (user_id, organization_id, business_space_id, company_id, role, status, started_at, created_by)
  values (v_user, v_org, v_company.business_space_id, p_company_id, p_role, 'ACTIVE', v_start, (select auth.uid()))
  returning id into v_id;

  return v_id;
end;
$$;

-- 9.7 Dar de baja una membership (ended_at = último día inclusive)
create or replace function public.end_membership(p_membership_id uuid, p_ended_at date default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.memberships%rowtype;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_NOT_FOUND';
  end if;
  if not (private.is_org_admin(v_m.organization_id)
          or (v_m.role in ('COMPANY_ADMIN', 'EMPLOYEE') and private.is_space_admin(v_m.business_space_id))
          or (v_m.role = 'EMPLOYEE' and private.is_company_admin(v_m.company_id))) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  perform private.close_membership(p_membership_id, coalesce(p_ended_at, private.fn_today()));
end;
$$;

-- 9.8 Fecha/hora de cierre para mostrar en el frontend
create or replace function public.get_selection_deadline(p_service_date date)
returns timestamptz
language sql stable security invoker set search_path = ''
as $$
  select private.selection_deadline(p_service_date);
$$;

-- =====================================================================
-- 10. PRIVILEGIOS
-- =====================================================================
-- anon no accede a nada del modelo
revoke all on all tables in schema public from anon;

-- helpers privados: ejecutables por authenticated (los usan las políticas)
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
-- ...excepto los que no hacen chequeo de permisos propio
revoke execute on function private.close_membership(uuid, date) from authenticated;
revoke execute on function private.handle_new_auth_user() from authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.handle_new_auth_user() to supabase_auth_admin;

-- RPCs públicas: solo usuarios autenticados
revoke execute on function public.get_my_roles()                                   from public, anon;
revoke execute on function public.get_my_menu(date)                                from public, anon;
revoke execute on function public.save_my_selection(uuid, jsonb)                   from public, anon;
revoke execute on function public.cancel_my_selection(uuid)                        from public, anon;
revoke execute on function public.find_profile_by_dni(text)                        from public, anon;
revoke execute on function public.add_company_member(uuid, text, public.app_role, date) from public, anon;
revoke execute on function public.end_membership(uuid, date)                       from public, anon;
revoke execute on function public.get_selection_deadline(date)                     from public, anon;

grant execute on function public.get_my_roles()                                   to authenticated;
grant execute on function public.get_my_menu(date)                                to authenticated;
grant execute on function public.save_my_selection(uuid, jsonb)                   to authenticated;
grant execute on function public.cancel_my_selection(uuid)                        to authenticated;
grant execute on function public.find_profile_by_dni(text)                        to authenticated;
grant execute on function public.add_company_member(uuid, text, public.app_role, date) to authenticated;
grant execute on function public.end_membership(uuid, date)                       to authenticated;
grant execute on function public.get_selection_deadline(date)                     to authenticated;

-- Fin de la migración de esquema.
