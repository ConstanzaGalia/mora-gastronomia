import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const CATALOG_PATH = new URL('./data/gastronomic-catalog.json', import.meta.url)
const CATEGORIES = [
  { name: 'Bandeja', slug: 'bandeja', sort_order: 10 },
  { name: 'Postre', slug: 'postre', sort_order: 20 },
  { name: 'Bebida', slug: 'bebida', sort_order: 30 },
  { name: 'Pan', slug: 'pan', sort_order: 40 },
]
const DEMO_OPTIONS = [
  ['bandeja', 'Milanesa con puré'],
  ['bandeja', 'Pollo'],
  ['bandeja', 'Pasta'],
  ['postre', 'Flan'],
  ['postre', 'Fruta'],
  ['postre', 'Yogur'],
  ['bebida', 'Agua'],
  ['bebida', 'Gaseosa'],
  ['bebida', 'Jugo'],
  ['pan', 'Pan francés'],
  ['pan', 'Pan integral'],
]

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

function dietaryDescription(item) {
  const tags = []
  if (item.sinTacc) tags.push('Sin T.A.C.C.')
  if (item.vegetariano) tags.push('Vegetariano')
  return tags.length > 0 ? tags.join(' · ') : null
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

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
if (!Array.isArray(catalog) || catalog.length === 0) {
  fail('El catálogo JSON está vacío o es inválido.')
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: space, error: spaceError } = await admin
  .from('business_spaces')
  .select('id')
  .eq('slug', 'balcarce')
  .single()
if (spaceError || !space) fail('No existe el espacio Balcarce. Corré el bootstrap antes del catálogo.', spaceError)

const { error: categoryUpsertError } = await admin.from('gastronomic_categories').upsert(
  CATEGORIES.map((category) => ({
    business_space_id: space.id,
    name: category.name,
    slug: category.slug,
    sort_order: category.sort_order,
    active: true,
  })),
  { onConflict: 'business_space_id,slug' },
)
if (categoryUpsertError) fail('No se pudieron crear/actualizar las categorías.', categoryUpsertError)

const { data: categories, error: categoryError } = await admin
  .from('gastronomic_categories')
  .select('id, slug')
  .eq('business_space_id', space.id)
  .in('slug', CATEGORIES.map((category) => category.slug))
if (categoryError || !categories?.length) fail('No se pudieron leer las categorías de Balcarce.', categoryError)

const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
const missingSlugs = CATEGORIES.map((category) => category.slug).filter((slug) => !categoryBySlug.has(slug))
if (missingSlugs.length) fail(`Faltan categorías: ${missingSlugs.join(', ')}`)

const rows = catalog.map((item) => {
  const category = categoryBySlug.get(item.category)
  if (!category) throw new Error(`Categoría desconocida en JSON: ${item.category}`)
  return {
    category_id: category.id,
    name: item.name,
    description: dietaryDescription(item),
    sort_order: item.sortOrder,
    active: true,
  }
})

const { error: optionError } = await admin
  .from('gastronomic_options')
  .upsert(rows, { onConflict: 'category_id,name' })
if (optionError) fail('No se pudieron cargar las opciones del catálogo.', optionError)

const catalogKeys = new Set(catalog.map((item) => `${item.category}::${item.name}`))
const demoToDisable = DEMO_OPTIONS.filter(([slug, name]) => !catalogKeys.has(`${slug}::${name}`))
const demoIds = []

for (const [slug, name] of demoToDisable) {
  const category = categoryBySlug.get(slug)
  if (!category) continue
  const { data: existing, error: existingError } = await admin
    .from('gastronomic_options')
    .select('id, name')
    .eq('category_id', category.id)
    .eq('name', name)
    .maybeSingle()
  if (existingError) fail(`No se pudo buscar la opción demo «${name}».`, existingError)
  if (existing) demoIds.push(existing.id)
}

if (demoIds.length > 0) {
  const { error: disableError } = await admin
    .from('gastronomic_options')
    .update({ active: false })
    .in('id', demoIds)
  if (disableError) fail('No se pudieron desactivar las opciones de ejemplo.', disableError)
}

const { data: loaded, error: countError } = await admin
  .from('gastronomic_options')
  .select('id, name, description, active, category_id')
  .in('category_id', categories.map((category) => category.id))
if (countError) fail('El catálogo se cargó, pero falló el conteo de verificación.', countError)

const counts = Object.fromEntries(CATEGORIES.map((category) => [category.slug, { active: 0, inactive: 0 }]))
for (const option of loaded) {
  const slug = categories.find((category) => category.id === option.category_id)?.slug
  if (!slug || !counts[slug]) continue
  if (option.active) counts[slug].active += 1
  else counts[slug].inactive += 1
}

const sample = loaded.find((option) => option.description === 'Sin T.A.C.C. · Vegetariano' && option.active)

console.log('Catálogo gastronómico cargado en Balcarce.')
for (const category of CATEGORIES) {
  const count = counts[category.slug]
  console.log(`  ${category.name}: ${count.active} activas${count.inactive ? `, ${count.inactive} inactivas` : ''}`)
}
console.log(`  Demo desactivadas: ${demoIds.length}`)
if (sample) console.log(`  Muestra tags: ${sample.name} → ${sample.description}`)
else console.log('  Aviso: no se encontró una opción activa con ambos tags.')
