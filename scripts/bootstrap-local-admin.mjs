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

const email = 'maria.gonzalez@balcarce.test'
const password = 'Balcarce2026'
const dni = '27111222'

const { data: listed } = await admin.auth.admin.listUsers()
let user = listed.users.find((item) => item.email === email)
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { dni, nombre: 'María', apellido: 'González' },
  })
  if (error) throw error
  user = data.user
}

const { data: profile, error: profileError } = await admin.from('profiles').select('id').eq('dni', dni).single()
if (profileError) throw profileError
const { data: space, error: spaceError } = await admin.from('business_spaces').select('id, organization_id').eq('slug', 'balcarce').single()
if (spaceError) throw spaceError

const { data: existing } = await admin
  .from('memberships')
  .select('id')
  .eq('user_id', profile.id)
  .eq('role', 'SPACE_ADMIN')
  .eq('status', 'ACTIVE')
  .maybeSingle()

if (!existing) {
  const { error } = await admin.from('memberships').insert({
    user_id: profile.id,
    organization_id: space.organization_id,
    business_space_id: space.id,
    role: 'SPACE_ADMIN',
    status: 'ACTIVE',
  })
  if (error) throw error
}

console.log(`Admin local listo: ${email} / ${password}`)
