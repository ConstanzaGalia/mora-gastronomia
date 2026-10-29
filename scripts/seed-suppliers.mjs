import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SUPPLIERS_PATH = new URL('./data/suppliers.json', import.meta.url)

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

const catalog = JSON.parse(readFileSync(SUPPLIERS_PATH, 'utf8'))
if (!Array.isArray(catalog) || catalog.length === 0) {
  fail('El JSON de proveedores está vacío o es inválido.')
}

const names = catalog.map((item) => item.name?.trim()).filter(Boolean)
const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
if (duplicates.length) fail(`Nombres duplicados en el JSON: ${[...new Set(duplicates)].join(', ')}`)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: space, error: spaceError } = await admin
  .from('business_spaces')
  .select('id')
  .eq('slug', 'balcarce')
  .single()
if (spaceError || !space) fail('No existe el espacio Balcarce. Corré el bootstrap antes de los proveedores.', spaceError)

const rows = catalog.map((item) => ({
  business_space_id: space.id,
  name: item.name.trim(),
  active: true,
}))

const { error: upsertError } = await admin
  .from('suppliers')
  .upsert(rows, { onConflict: 'business_space_id,name' })
if (upsertError) fail('No se pudieron cargar los proveedores.', upsertError)

const { data: loaded, error: countError } = await admin
  .from('suppliers')
  .select('id, name, active')
  .eq('business_space_id', space.id)
  .order('name')
if (countError) fail('Los proveedores se cargaron, pero falló el conteo de verificación.', countError)

const catalogNames = new Set(names)
const active = (loaded ?? []).filter((supplier) => supplier.active)
const missing = names.filter((name) => !loaded?.some((supplier) => supplier.name === name && supplier.active))
const extraActive = active.filter((supplier) => !catalogNames.has(supplier.name))

console.log('Proveedores cargados en Balcarce.')
console.log(`  Activos: ${active.length}`)
console.log(`  En JSON: ${catalog.length}`)
if (missing.length) console.log(`  Faltantes: ${missing.join(', ')}`)
if (extraActive.length) console.log(`  Extra activos (no tocados): ${extraActive.map((supplier) => supplier.name).join(', ')}`)
for (const item of catalog) {
  console.log(`  - ${item.name} · ${item.rubro}`)
}
