-- El login del encargado vive en auth.users.email. La ficha muestra profiles.email.
-- Si se promovió a alguien que ya existía, el contacto no se copiaba.

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null
  and u.email not ilike '%@empleados.mora';
