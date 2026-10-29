import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const COMPANIES_PATH = new URL('./data/companies.json', import.meta.url)

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

const catalog = JSON.parse(readFileSync(COMPANIES_PATH, 'utf8'))
if (!Array.isArray(catalog) || catalog.length === 0) {
  fail('El JSON de empresas está vacío o es inválido.')
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
if (spaceError || !space) fail('No existe el espacio Balcarce. Corré el bootstrap antes de las empresas.', spaceError)

const { data: existing, error: existingError } = await admin
  .from('companies')
  .select('id, nombre_comercial, active')
  .eq('business_space_id', space.id)
if (existingError) fail('No se pudieron leer las empresas actuales.', existingError)

const byName = new Map((existing ?? []).map((company) => [company.nombre_comercial, company]))
let created = 0
const companies = []

for (const item of catalog) {
  const name = item.name.trim()
  const found = byName.get(name)
  if (found) {
    if (!found.active) {
      const { error } = await admin.from('companies').update({ active: true }).eq('id', found.id)
      if (error) fail(`No se pudo reactivar «${name}».`, error)
    }
    companies.push({ id: found.id, name, created: false, sectorizada: Boolean(item.sectorizada) })
    continue
  }

  const { data, error } = await admin
    .from('companies')
    .insert({
      business_space_id: space.id,
      nombre_comercial: name,
      active: true,
    })
    .select('id, nombre_comercial')
    .single()
  if (error) fail(`No se pudo crear «${name}».`, error)
  created += 1
  byName.set(name, data)
  companies.push({ id: data.id, name, created: true, sectorizada: Boolean(item.sectorizada) })
}

const { data: categories, error: categoryError } = await admin
  .from('gastronomic_categories')
  .select('id, slug, name, active')
  .eq('business_space_id', space.id)
  .eq('active', true)
if (categoryError) fail('No se pudieron leer las categorías gastronómicas.', categoryError)
if (!categories?.length) fail('No hay categorías activas en Balcarce. Corré el seed del catálogo antes.')

let linked = 0
for (const company of companies) {
  for (const category of categories) {
    const { data: row, error: linkError } = await admin
      .from('company_gastronomic_categories')
      .select('id, active')
      .eq('company_id', company.id)
      .eq('category_id', category.id)
      .maybeSingle()
    if (linkError) fail(`No se pudo leer categorías de «${company.name}».`, linkError)
    if (!row) {
      const { error } = await admin.from('company_gastronomic_categories').insert({
        company_id: company.id,
        category_id: category.id,
        business_space_id: space.id,
        active: true,
      })
      if (error) fail(`No se pudo habilitar ${category.slug} en «${company.name}».`, error)
      linked += 1
      continue
    }
    if (!row.active) {
      const { error } = await admin.from('company_gastronomic_categories').update({ active: true }).eq('id', row.id)
      if (error) fail(`No se pudo reactivar ${category.slug} en «${company.name}».`, error)
      linked += 1
    }
  }
}

const { data: loaded, error: countError } = await admin
  .from('companies')
  .select('id, nombre_comercial, active')
  .eq('business_space_id', space.id)
  .order('nombre_comercial')
if (countError) fail('Las empresas se cargaron, pero falló el conteo de verificación.', countError)

console.log('Empresas cargadas en Balcarce.')
console.log(`  En JSON: ${catalog.length}`)
console.log(`  Creadas ahora: ${created}`)
console.log(`  Vínculos de categoría nuevos/reactivados: ${linked}`)
console.log(`  Activas en el espacio: ${loaded.filter((company) => company.active).length}`)
for (const company of companies) {
  console.log(`  - ${company.name}${company.sectorizada ? ' (sectorizada; los sectores se cargan en la ficha)' : ''}${company.created ? ' [nueva]' : ''}`)
}
