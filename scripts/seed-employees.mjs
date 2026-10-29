import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const USERS_PATH = new URL('./data/zuliani-usuarios.json', import.meta.url)
const EMPLOYEE_EMAIL_DOMAIN = 'empleados.mora'
const APPLY = process.argv.includes('--apply')

function loadEnv() {
  return Object.fromEntries(
    readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        const key = line.slice(0, index).trim()
        let value = line.slice(index + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        return [key, value]
      }),
  )
}

function fail(message, error) {
  console.error(message)
  if (error) console.error(error)
  process.exit(1)
}

const env = loadEnv()
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  fail('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
}

const users = JSON.parse(readFileSync(USERS_PATH, 'utf8'))
if (!Array.isArray(users) || users.length === 0) fail('El JSON de usuarios está vacío o es inválido.')

const dnis = users.map((user) => user.dni)
const repeated = dnis.filter((dni, index) => dnis.indexOf(dni) !== index)
if (repeated.length) fail(`DNI repetidos en el JSON: ${[...new Set(repeated)].join(', ')}`)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: space, error: spaceError } = await admin
  .from('business_spaces')
  .select('id, organization_id')
  .eq('slug', 'balcarce')
  .single()
if (spaceError || !space) fail('No existe el espacio Balcarce. Corré el bootstrap antes.', spaceError)

const { data: companyRows, error: companyError } = await admin
  .from('companies')
  .select('id, nombre_comercial')
  .eq('business_space_id', space.id)
if (companyError) fail('No se pudieron leer las empresas.', companyError)
const companyByName = new Map(companyRows.map((company) => [company.nombre_comercial, company.id]))

const pending = users.flatMap((user) =>
  user.empresas.filter(Boolean).map((empresa) => ({ ...user, empresa })),
)
const withoutCompany = users.filter((user) => !user.empresas.some(Boolean))
const missing = [...new Set(pending.map((user) => user.empresa).filter((name) => !companyByName.has(name)))]
if (missing.length) fail(`Empresas inexistentes en la base (corré seed-companies): ${missing.join(', ')}`)

const summary = new Map()
for (const user of pending) {
  const key = `${user.empresa} · ${user.rol}`
  summary.set(key, (summary.get(key) ?? 0) + 1)
}
const shared = users.filter((user) => user.rol === 'EMPLOYEE' && user.empresas.filter(Boolean).length > 1)
console.log(`Personas: ${users.length - withoutCompany.length} · membresías a crear: ${pending.length} (personas sin empresa, omitidas: ${withoutCompany.length})`)
for (const [key, count] of [...summary].sort()) console.log(`  ${key}: ${count}`)
console.log(`  Empleados que pueden pedir en más de una empresa: ${shared.length}`)

if (!APPLY) {
  console.log('\nSimulación: no se escribió nada. Agregá --apply para crear los usuarios.')
  process.exit(0)
}

const authByEmail = await listAuthUsers()
const { data: existingMemberships, error: membershipError } = await admin
  .from('memberships')
  .select('user_id, company_id, role')
  .eq('business_space_id', space.id)
  .eq('status', 'ACTIVE')
if (membershipError) fail('No se pudieron leer las membresías.', membershipError)
const membershipKeys = new Set(existingMemberships.map((row) => `${row.user_id}|${row.company_id}|${row.role}`))

let createdUsers = 0
let createdMemberships = 0
let skipped = 0
const failures = []

for (const user of pending) {
  try {
    const isAdmin = user.rol === 'COMPANY_ADMIN'
    const email = isAdmin ? user.email : `${user.dni}@${EMPLOYEE_EMAIL_DOMAIN}`
    if (!email) throw new Error('El encargado no tiene email')

    if (!authByEmail.has(email)) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: user.dni,
        email_confirm: true,
        user_metadata: { dni: user.dni, nombre: user.nombre, apellido: user.apellido },
      })
      if (error) throw error
      authByEmail.set(email, data.user)
      createdUsers += 1
    }

    const { data: profile, error: profileError } = await admin.from('profiles').select('id').eq('dni', user.dni).single()
    if (profileError) throw profileError

    const companyId = companyByName.get(user.empresa)
    const key = `${profile.id}|${companyId}|${user.rol}`
    if (membershipKeys.has(key)) {
      skipped += 1
      continue
    }
    const { error } = await admin.from('memberships').insert({
      user_id: profile.id,
      organization_id: space.organization_id,
      business_space_id: space.id,
      company_id: companyId,
      role: user.rol,
      status: 'ACTIVE',
      started_at: '2026-01-06',
    })
    if (error) throw error
    membershipKeys.add(key)
    createdMemberships += 1
  } catch (error) {
    failures.push(`${user.dni} ${user.nombre} ${user.apellido}: ${error.message ?? error}`)
  }
}

console.log(`\nUsuarios creados: ${createdUsers}`)
console.log(`Membresías creadas: ${createdMemberships}`)
console.log(`Ya existentes (omitidos): ${skipped}`)
if (failures.length) {
  console.log(`Fallidos: ${failures.length}`)
  for (const line of failures) console.log(`  - ${line}`)
  process.exit(1)
}

async function listAuthUsers() {
  const byEmail = new Map()
  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail('No se pudieron listar los usuarios de Auth.', error)
    for (const authUser of data.users) byEmail.set(authUser.email, authUser)
    if (data.users.length < 200) break
  }
  return byEmail
}
