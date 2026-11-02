import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envPath = process.argv[2] ?? new URL('../.env.local', import.meta.url)
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }),
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = 'balcarce@moragastronomia.com'
const password = process.env.KITCHEN_PASSWORD || 'Balcarce2026'
const dni = process.env.KITCHEN_DNI || '20999887'
const nombre = 'Cocina'
const apellido = 'Balcarce'

const { data: listed, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError
let user = listed.users.find((item) => item.email === email)

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { dni, nombre, apellido, email_contacto: email },
  })
  if (error) throw error
  user = data.user
  console.log(`Usuario creado: ${email}`)
} else {
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { dni, nombre, apellido, email_contacto: email },
  })
  if (error) throw error
  console.log(`Usuario existente: se actualizó la contraseña de ${email}`)
}

const { data: org, error: orgError } = await admin.from('organizations').select('id').eq('slug', 'mora-gastronomia').single()
if (orgError) throw orgError

const { data: space, error: spaceError } = await admin.from('business_spaces').select('id').eq('slug', 'balcarce').single()
if (spaceError) throw spaceError

let { data: profile } = await admin.from('profiles').select('id').eq('id', user.id).maybeSingle()
if (!profile) {
  const { error } = await admin.from('profiles').insert({
    id: user.id,
    dni,
    nombre,
    apellido,
    email,
  })
  if (error) throw error
  profile = { id: user.id }
  console.log('Perfil creado para Cocina Balcarce.')
}

const { data: existing } = await admin
  .from('memberships')
  .select('id')
  .eq('user_id', profile.id)
  .eq('role', 'KITCHEN')
  .eq('status', 'ACTIVE')
  .eq('business_space_id', space.id)
  .maybeSingle()

if (!existing) {
  const { error } = await admin.from('memberships').insert({
    user_id: profile.id,
    organization_id: org.id,
    business_space_id: space.id,
    role: 'KITCHEN',
    status: 'ACTIVE',
  })
  if (error) throw error
  console.log('Membership KITCHEN asignada en Balcarce.')
} else {
  console.log('Ya tenía membership KITCHEN en Balcarce.')
}

console.log(`Listo: ${email} entra como Cocina y solo ve Inicio, Pedidos y Reportes.`)
