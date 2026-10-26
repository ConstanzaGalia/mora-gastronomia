import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
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

const email = 'amparo@mora.com'
const password = process.env.AMPARO_PASSWORD
const dni = process.env.AMPARO_DNI || '20999888'
const nombre = process.env.AMPARO_NOMBRE || 'Amparo'
const apellido = process.env.AMPARO_APELLIDO || 'Mora'

const { data: listed } = await admin.auth.admin.listUsers()
let user = listed.users.find((item) => item.email === email)

if (!user) {
  if (!password) {
    console.error(`No existe ${email} en Auth. Definí AMPARO_PASSWORD para crearlo en local.`)
    process.exit(1)
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { dni, nombre, apellido },
  })
  if (error) throw error
  user = data.user
  console.log(`Usuario creado: ${email}`)
}

const { data: org, error: orgError } = await admin.from('organizations').select('id').eq('slug', 'mora-gastronomia').single()
if (orgError) throw orgError

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
  console.log('Perfil creado para Amparo.')
}

const { data: existing } = await admin
  .from('memberships')
  .select('id')
  .eq('user_id', profile.id)
  .eq('role', 'ORG_ADMIN')
  .eq('status', 'ACTIVE')
  .maybeSingle()

if (!existing) {
  const { error } = await admin.from('memberships').insert({
    user_id: profile.id,
    organization_id: org.id,
    role: 'ORG_ADMIN',
    status: 'ACTIVE',
  })
  if (error) throw error
  console.log('Membership ORG_ADMIN asignada.')
} else {
  console.log('Ya tenía membership ORG_ADMIN.')
}

console.log(`Listo: ${email} entra como Administrador Mora y puede cambiar entre Balcarce y Eventos.`)
