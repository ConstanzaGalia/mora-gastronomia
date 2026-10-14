import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SERVICE_DATE = '2026-10-09'
const ENCARGADO_PASSWORD = 'Balcarce2026'

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

const companies = [
  {
    nombre: 'Estudio Ledesma',
    cuit: '30711111118',
    encargado: { email: 'ledesma.encargado@balcarce.test', dni: '30111001', nombre: 'Laura', apellido: 'Ledesma' },
    people: [
      { dni: '30111011', nombre: 'Ana', apellido: 'Álvarez', items: ['Milanesa con puré', 'Agua', 'Flan'] },
      { dni: '30111012', nombre: 'Bruno', apellido: 'Álvarez', items: ['Pollo', 'Jugo'] },
      { dni: '30111013', nombre: 'Carla', apellido: 'Gómez', items: ['Pasta', 'Gaseosa', 'Pan francés'] },
      { dni: '30111014', nombre: 'Diego', apellido: 'López', items: null },
      { dni: '30111015', nombre: 'Elena', apellido: 'Núñez', items: ['Milanesa con puré', 'Agua', 'Yogur', 'Pan integral'] },
      { dni: '30111016', nombre: 'Luis', apellido: 'Ñoño', items: ['Pollo', 'Agua', 'Fruta'] },
      { dni: '30111017', nombre: 'Facundo', apellido: 'Pérez', items: ['Pasta', 'Gaseosa'], cancelled: true },
      { dni: '30111018', nombre: 'Zoe', apellido: 'Suárez', items: ['Pollo', 'Agua'] },
    ],
  },
  {
    nombre: 'Grupo Horizonte',
    cuit: '30722222226',
    encargado: { email: 'horizonte.encargado@balcarce.test', dni: '30112001', nombre: 'Martín', apellido: 'Herrera' },
    people: [
      { dni: '30112011', nombre: 'Bruno', apellido: 'Acosta', items: ['Milanesa con puré', 'Agua'] },
      { dni: '30112012', nombre: 'Camila', apellido: 'Benítez', items: ['Pasta', 'Jugo', 'Flan', 'Pan francés'] },
      { dni: '30112013', nombre: 'Diego', apellido: 'Castro', items: null },
      { dni: '30112014', nombre: 'Elena', apellido: 'Díaz', items: ['Pollo', 'Gaseosa'] },
      { dni: '30112015', nombre: 'Ana', apellido: 'Fernández', items: ['Milanesa con puré', 'Agua', 'Fruta'] },
      { dni: '30112016', nombre: 'Mateo', apellido: 'Herrera', items: ['Pasta', 'Jugo', 'Pan integral'] },
    ],
  },
]

const { data: space, error: spaceError } = await admin.from('business_spaces').select('id, organization_id').eq('slug', 'balcarce').single()
if (spaceError) throw spaceError

const { data: categories, error: categoryError } = await admin
  .from('gastronomic_categories')
  .select('id, slug')
  .eq('business_space_id', space.id)
if (categoryError) throw categoryError

const { data: options, error: optionError } = await admin
  .from('gastronomic_options')
  .select('id, name, category_id')
  .in('category_id', categories.map((category) => category.id))
if (optionError) throw optionError
const optionByName = new Map()
for (const option of options) {
  if (optionByName.has(option.name)) throw new Error(`La opción ${option.name} está repetida en el catálogo.`)
  optionByName.set(option.name, option)
}

const { data: day, error: dayError } = await admin
  .from('calendar_days')
  .select('id, is_service_day, calendar_week_id')
  .eq('business_space_id', space.id)
  .eq('service_date', SERVICE_DATE)
  .maybeSingle()
if (dayError) throw dayError
if (!day?.is_service_day) throw new Error(`No hay día de servicio publicado para el ${SERVICE_DATE}.`)
const { data: week, error: weekError } = await admin.from('calendar_weeks').select('status').eq('id', day.calendar_week_id).single()
if (weekError) throw weekError
if (week.status !== 'PUBLISHED') throw new Error(`La semana del ${SERVICE_DATE} no está publicada.`)

const selections = []

for (const companySeed of companies) {
  let company = (await admin
    .from('companies')
    .select('id')
    .eq('business_space_id', space.id)
    .eq('nombre_comercial', companySeed.nombre)
    .maybeSingle()).data
  if (!company) {
    const { data, error } = await admin.from('companies').insert({
      business_space_id: space.id,
      nombre_comercial: companySeed.nombre,
      cuit: companySeed.cuit,
      active: true,
    }).select('id').single()
    if (error) throw error
    company = data
  }

  for (const category of categories) {
    const { data: enabled } = await admin
      .from('company_gastronomic_categories')
      .select('id')
      .eq('company_id', company.id)
      .eq('category_id', category.id)
      .maybeSingle()
    if (!enabled) {
      const { error } = await admin.from('company_gastronomic_categories').insert({
        company_id: company.id,
        category_id: category.id,
        business_space_id: space.id,
        active: true,
      })
      if (error) throw error
    }
  }

  const encargado = await ensureUser(companySeed.encargado, companySeed.encargado.email, ENCARGADO_PASSWORD)
  await ensureMembership(encargado.id, company.id, 'COMPANY_ADMIN')

  for (const person of companySeed.people) {
    const user = await ensureUser(person, `${person.dni}@empleados.mora`, person.dni)
    const membershipId = await ensureMembership(user.id, company.id, 'EMPLOYEE')
    if (!person.items) continue
    selections.push({
      employeeId: user.id,
      membershipId,
      companyId: company.id,
      cancelled: Boolean(person.cancelled),
      items: person.items.map((name) => {
        const option = optionByName.get(name)
        if (!option) throw new Error(`No existe la opción ${name} en el catálogo.`)
        return option
      }),
    })
  }
}

const usedOptionIds = [...new Set(selections.flatMap((selection) => selection.items.map((item) => item.id)))]
const { data: available, error: availableError } = await admin
  .from('daily_availability')
  .select('option_id')
  .eq('calendar_day_id', day.id)
  .in('option_id', usedOptionIds)
if (availableError) throw availableError
const availableIds = new Set((available ?? []).map((row) => row.option_id))
for (const optionId of usedOptionIds) {
  if (availableIds.has(optionId)) continue
  const option = options.find((item) => item.id === optionId)
  const { error } = await admin.from('daily_availability').insert({
    calendar_day_id: day.id,
    business_space_id: space.id,
    category_id: option.category_id,
    option_id: optionId,
    sort_order: 0,
  })
  if (error) throw error
}

const employeeIds = selections.map((selection) => selection.employeeId)
const { data: existing, error: existingError } = await admin
  .from('employee_selections')
  .select('employee_id')
  .eq('calendar_day_id', day.id)
  .in('employee_id', employeeIds)
if (existingError) throw existingError
const already = new Set((existing ?? []).map((row) => row.employee_id))
const pending = selections.filter((selection) => !already.has(selection.employeeId))

if (pending.length > 0) {
  const statements = pending.map((selection) => {
    const selectionId = randomUUID()
    const status = selection.cancelled ? 'CANCELLED' : 'SUBMITTED'
    const cancelledAt = selection.cancelled ? 'now()' : 'null'
    const header = `
      insert into public.employee_selections (
        id, employee_id, membership_id, company_id, business_space_id, calendar_day_id,
        service_date, status, locked_at, cancelled_at
      ) values (
        ${sqlUuid(selectionId)}, ${sqlUuid(selection.employeeId)}, ${sqlUuid(selection.membershipId)},
        ${sqlUuid(selection.companyId)}, ${sqlUuid(space.id)}, ${sqlUuid(day.id)},
        '${SERVICE_DATE}', '${status}', private.selection_deadline('${SERVICE_DATE}'::date), ${cancelledAt}
      );`
    const items = selection.items.map((item) => `
      insert into public.employee_selection_items (selection_id, category_id, option_id)
      values (${sqlUuid(selectionId)}, ${sqlUuid(item.category_id)}, ${sqlUuid(item.id)});`).join('\n')
    return header + items
  }).join('\n')

  const sql = `
    begin;
    alter table public.employee_selections disable trigger employee_selections_validate;
    alter table public.employee_selection_items disable trigger selection_items_validate;
    ${statements}
    alter table public.employee_selections enable trigger employee_selections_validate;
    alter table public.employee_selection_items enable trigger selection_items_validate;
    commit;
  `
  const result = spawnSync('psql', [env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'psql no pudo insertar las elecciones')
  }
}

console.log(`Comensales de prueba listos para el ${SERVICE_DATE}.`)
console.log(`Encargada Ledesma: ledesma.encargado@balcarce.test / ${ENCARGADO_PASSWORD}`)
console.log(`Encargado Horizonte: horizonte.encargado@balcarce.test / ${ENCARGADO_PASSWORD}`)
console.log('Empleados: DNI y la misma clave.')

async function ensureUser(person, email, password) {
  const existing = await findUser(email)
  if (!existing) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { dni: person.dni, nombre: person.nombre, apellido: person.apellido },
    })
    if (error) throw error
  }
  const { data: profile, error } = await admin.from('profiles').select('id').eq('dni', person.dni).single()
  if (error) throw error
  return profile
}

async function ensureMembership(userId, companyId, role) {
  const { data: existing, error: existingError } = await admin
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('role', role)
    .eq('status', 'ACTIVE')
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return existing.id
  const { data, error } = await admin.from('memberships').insert({
    user_id: userId,
    organization_id: space.organization_id,
    business_space_id: space.id,
    company_id: companyId,
    role,
    status: 'ACTIVE',
    started_at: '2026-01-06',
  }).select('id').single()
  if (error) throw error
  return data.id
}

async function findUser(email) {
  let page = 1
  while (page < 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((user) => user.email === email)
    if (found) return found
    if (data.users.length < 200) return null
    page += 1
  }
  return null
}

function sqlUuid(value) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error('Identificador inválido')
  return `'${value}'::uuid`
}
