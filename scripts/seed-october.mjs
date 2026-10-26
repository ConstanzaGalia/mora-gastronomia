import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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

const WEEK_STARTS = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']
const MENU = [
  { bandeja: ['Milanesa con puré', 'Pollo'], postre: ['Flan', 'Fruta'], bebida: ['Agua', 'Gaseosa'], pan: ['Pan francés'] },
  { bandeja: ['Pollo', 'Pasta'], postre: ['Yogur'], bebida: ['Agua', 'Jugo'], pan: ['Pan integral'] },
  { bandeja: ['Pasta', 'Milanesa con puré'], postre: ['Flan'], bebida: ['Soda', 'Agua'], pan: ['Pan francés'] },
  { bandeja: ['Milanesa con puré', 'Pasta'], postre: ['Fruta', 'Yogur'], bebida: ['Jugo', 'Gaseosa'], pan: ['Pan integral'] },
  { bandeja: ['Pollo'], postre: ['Flan', 'Fruta'], bebida: ['Agua', 'Soda'], pan: ['Pan francés', 'Pan integral'] },
]

const { data: space, error: spaceError } = await admin.from('business_spaces').select('id').eq('slug', 'balcarce').single()
if (spaceError) throw spaceError

const { data: categories, error: categoryError } = await admin
  .from('gastronomic_categories')
  .select('id, slug, name, sort_order')
  .eq('business_space_id', space.id)
  .eq('active', true)
if (categoryError) throw categoryError
const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))

const { data: options, error: optionError } = await admin
  .from('gastronomic_options')
  .select('id, name, category_id')
  .eq('active', true)
  .in('category_id', categories.map((category) => category.id))
if (optionError) throw optionError
const optionByName = new Map(options.map((option) => [option.name, option]))

const { data: companies, error: companyError } = await admin
  .from('companies')
  .select('id, nombre_comercial')
  .eq('business_space_id', space.id)
  .eq('active', true)
if (companyError) throw companyError
const companyByName = new Map(companies.map((company) => [company.nombre_comercial, company]))
const ledesma = companyByName.get('Estudio Ledesma')
const horizonte = companyByName.get('Grupo Horizonte')
if (!ledesma || !horizonte) throw new Error('Faltan Estudio Ledesma o Grupo Horizonte.')

for (const company of [ledesma, horizonte]) {
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
}

for (const weekStart of WEEK_STARTS) {
  let week = (await admin
    .from('calendar_weeks')
    .select('id, status')
    .eq('business_space_id', space.id)
    .eq('week_start', weekStart)
    .maybeSingle()).data
  if (!week) {
    const { data, error } = await admin.from('calendar_weeks').insert({
      business_space_id: space.id,
      week_start: weekStart,
      week_end: addDays(weekStart, 4),
      status: 'DRAFT',
    }).select('id, status').single()
    if (error) throw error
    week = data
  }

  const { data: existingDays, error: daysError } = await admin
    .from('calendar_days')
    .select('id, service_date')
    .eq('calendar_week_id', week.id)
  if (daysError) throw daysError
  const have = new Set((existingDays ?? []).map((day) => day.service_date))
  const missing = [0, 1, 2, 3, 4]
    .map((offset) => addDays(weekStart, offset))
    .filter((date) => !have.has(date))
    .map((serviceDate) => ({
      calendar_week_id: week.id,
      business_space_id: space.id,
      service_date: serviceDate,
      is_service_day: true,
    }))
  if (missing.length) {
    const { error } = await admin.from('calendar_days').insert(missing)
    if (error) throw error
  }
}

const { data: days, error: allDaysError } = await admin
  .from('calendar_days')
  .select('id, service_date, is_service_day, calendar_week_id')
  .eq('business_space_id', space.id)
  .gte('service_date', '2026-09-28')
  .lte('service_date', '2026-10-30')
  .order('service_date')
if (allDaysError) throw allDaysError

for (const day of days) {
  if (!day.is_service_day) continue
  const { count, error: countError } = await admin
    .from('daily_availability')
    .select('id', { count: 'exact', head: true })
    .eq('calendar_day_id', day.id)
  if (countError) throw countError
  if (count > 0) continue
  const menu = MENU[weekday(day.service_date)]
  const rows = []
  for (const [slug, names] of Object.entries(menu)) {
    const category = categoryBySlug.get(slug)
    if (!category) continue
    names.forEach((name, index) => {
      const option = optionByName.get(name) ?? options.find((item) => item.category_id === category.id)
      if (!option || option.category_id !== category.id) return
      rows.push({
        calendar_day_id: day.id,
        business_space_id: space.id,
        category_id: category.id,
        option_id: option.id,
        sort_order: index,
      })
    })
  }
  const { error } = await admin.from('daily_availability').insert(rows)
  if (error) throw error
}

const { data: draftWeeks, error: draftError } = await admin
  .from('calendar_weeks')
  .select('id')
  .eq('business_space_id', space.id)
  .eq('status', 'DRAFT')
  .in('week_start', WEEK_STARTS)
if (draftError) throw draftError
for (const week of draftWeeks ?? []) {
  const { error } = await admin.from('calendar_weeks').update({ status: 'PUBLISHED' }).eq('id', week.id)
  if (error) throw error
}

const { data: availability, error: availabilityError } = await admin
  .from('daily_availability')
  .select('calendar_day_id, category_id, option_id, sort_order')
  .in('calendar_day_id', days.map((day) => day.id))
if (availabilityError) throw availabilityError
const menuByDay = new Map()
for (const slot of availability ?? []) {
  const list = menuByDay.get(slot.calendar_day_id) ?? []
  list.push(slot)
  menuByDay.set(slot.calendar_day_id, list)
}

const { data: memberships, error: membershipError } = await admin
  .from('memberships')
  .select('id, user_id, company_id, started_at, ended_at, profiles!memberships_user_id_fkey(nombre, apellido, dni)')
  .eq('business_space_id', space.id)
  .eq('role', 'EMPLOYEE')
  .eq('status', 'ACTIVE')
if (membershipError) throw membershipError

const people = []
const seenUsers = new Set()
for (const membership of memberships ?? []) {
  if (seenUsers.has(membership.user_id)) continue
  seenUsers.add(membership.user_id)
  const profile = Array.isArray(membership.profiles) ? membership.profiles[0] : membership.profiles
  people.push({
    membershipId: membership.id,
    userId: membership.user_id,
    companyId: membership.company_id,
    started: membership.started_at,
    ended: membership.ended_at,
    nombre: profile?.nombre ?? '',
    apellido: profile?.apellido ?? '',
  })
}
people.sort((a, b) => a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es'))

const octoberDays = days.filter((day) => day.is_service_day && day.service_date >= '2026-10-01' && day.service_date <= '2026-10-31')
const { data: existingSelections, error: existingError } = await admin
  .from('employee_selections')
  .select('employee_id, calendar_day_id')
  .in('calendar_day_id', octoberDays.map((day) => day.id))
if (existingError) throw existingError
const already = new Set((existingSelections ?? []).map((row) => `${row.employee_id}|${row.calendar_day_id}`))

const statements = []
let created = 0
for (const day of octoberDays) {
  const slots = menuByDay.get(day.id) ?? []
  const byCategory = new Map()
  for (const slot of slots) {
    const list = byCategory.get(slot.category_id) ?? []
    list.push(slot)
    byCategory.set(slot.category_id, list)
  }
  const bandeja = categoryBySlug.get('bandeja')
  people.forEach((person, personIndex) => {
    if (person.started && person.started > day.service_date) return
    if (person.ended && person.ended < day.service_date) return
    if (already.has(`${person.userId}|${day.id}`)) return
    const skips = person.apellido === 'López' || person.apellido === 'Castro'
    if (skips) return
    const dayIndex = octoberDays.indexOf(day)
    const cancelled = person.apellido === 'Pérez' && person.nombre === 'Facundo' && day.service_date === '2026-10-15'
    const chosen = []
    for (const category of categories) {
      const available = byCategory.get(category.id) ?? []
      if (!available.length) continue
      if (category.id !== bandeja?.id && (personIndex + dayIndex + category.sort_order) % 3 === 0) continue
      chosen.push(available[(personIndex + dayIndex) % available.length])
    }
    if (!chosen.length) return
    const selectionId = randomUUID()
    const status = cancelled ? 'CANCELLED' : 'SUBMITTED'
    const cancelledAt = cancelled ? 'now()' : 'null'
    statements.push(`
      insert into public.employee_selections (
        id, employee_id, membership_id, company_id, business_space_id, calendar_day_id,
        service_date, status, locked_at, cancelled_at
      ) values (
        ${sqlUuid(selectionId)}, ${sqlUuid(person.userId)}, ${sqlUuid(person.membershipId)},
        ${sqlUuid(person.companyId)}, ${sqlUuid(space.id)}, ${sqlUuid(day.id)},
        '${day.service_date}', '${status}', private.selection_deadline('${day.service_date}'::date), ${cancelledAt}
      );`)
    for (const item of chosen) {
      statements.push(`
        insert into public.employee_selection_items (selection_id, category_id, option_id)
        values (${sqlUuid(selectionId)}, ${sqlUuid(item.category_id)}, ${sqlUuid(item.option_id)});`)
    }
    created += 1
  })
}

const extraRows = []
for (const date of ['2026-10-06', '2026-10-20', '2026-10-27']) {
  const day = octoberDays.find((item) => item.service_date === date)
  const bandeja = categoryBySlug.get('bandeja')
  const slot = (menuByDay.get(day?.id) ?? []).find((item) => item.category_id === bandeja?.id)
  if (!day || !slot) continue
  extraRows.push(`
    insert into public.company_day_extras (calendar_day_id, company_id, business_space_id, category_id, option_id, quantity)
    values (${sqlUuid(day.id)}, ${sqlUuid(horizonte.id)}, ${sqlUuid(space.id)}, ${sqlUuid(slot.category_id)}, ${sqlUuid(slot.option_id)}, 3)
    on conflict (calendar_day_id, company_id, option_id) do nothing;`)
}

if (statements.length || extraRows.length) {
  const sql = `
    begin;
    alter table public.employee_selections disable trigger employee_selections_validate;
    alter table public.employee_selection_items disable trigger selection_items_validate;
    alter table public.company_day_extras disable trigger company_day_extras_validate;
    ${statements.join('\n')}
    ${extraRows.join('\n')}
    alter table public.company_day_extras enable trigger company_day_extras_validate;
    alter table public.employee_selection_items enable trigger selection_items_validate;
    alter table public.employee_selections enable trigger employee_selections_validate;
    commit;
  `
  const result = spawnSync('psql', [env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'psql no pudo cargar octubre')
}

for (const date of ['2026-10-05', '2026-10-13', '2026-10-19', '2026-10-26']) {
  const day = octoberDays.find((item) => item.service_date === date)
  if (!day) continue
  const { data: marked } = await admin
    .from('day_company_extensions')
    .select('company_id')
    .eq('calendar_day_id', day.id)
    .eq('company_id', ledesma.id)
    .maybeSingle()
  if (marked) continue
  const { error } = await admin.from('day_company_extensions').insert({
    calendar_day_id: day.id,
    company_id: ledesma.id,
    business_space_id: space.id,
  })
  if (error) throw error
}

await ensurePrice('company_tray_prices', horizonte.id, '2026-10-01', 7800)

const extraCharges = [
  ['2026-10-02', 'Armado de viandas', 54000],
  ['2026-10-07', 'Apoyo en planta', 36000],
  ['2026-10-14', 'Recambio de turno', 49500],
  ['2026-10-21', 'Evento interno', 72000],
  ['2026-10-28', 'Cierre de cocina', 27000],
]
for (const [chargedOn, concept, amount] of extraCharges) {
  const { data: exists } = await admin
    .from('company_charges')
    .select('id')
    .eq('company_id', ledesma.id)
    .eq('charged_on', chargedOn)
    .eq('concept', concept)
    .maybeSingle()
  if (exists) continue
  const { error } = await admin.from('company_charges').insert({
    company_id: ledesma.id,
    business_space_id: space.id,
    charged_on: chargedOn,
    concept,
    amount,
  })
  if (error) throw error
}

const collections = [
  [ledesma.id, '2026-10-03', 180000, 'Cobro primera quincena'],
  [ledesma.id, '2026-10-17', 150000, 'Cobro segunda quincena'],
  [horizonte.id, '2026-10-10', 220000, 'Cobro de octubre'],
]
for (const [companyId, paidOn, amount, note] of collections) {
  const { data: exists } = await admin
    .from('company_payments')
    .select('id')
    .eq('company_id', companyId)
    .eq('paid_on', paidOn)
    .eq('note', note)
    .maybeSingle()
  if (exists) continue
  const { error } = await admin.from('company_payments').insert({
    company_id: companyId,
    business_space_id: space.id,
    paid_on: paidOn,
    amount,
    note,
  })
  if (error) throw error
}

const expenses = [
  ['2026-10-02', 'Flete', 18000],
  ['2026-10-06', 'Descartables', 24000],
  ['2026-10-09', 'Nafta', 35000],
  ['2026-10-13', 'Limpieza de cocina', 15000],
  ['2026-10-16', 'Envases', 42000],
  ['2026-10-21', 'Insumos de cocina', 28000],
  ['2026-10-27', 'Flete', 18000],
  ['2026-10-30', 'Gas', 22000],
]
for (const [spentOn, concept, amount] of expenses) {
  const { data: exists } = await admin
    .from('space_expenses')
    .select('id')
    .eq('business_space_id', space.id)
    .eq('spent_on', spentOn)
    .eq('concept', concept)
    .maybeSingle()
  if (exists) continue
  const { error } = await admin.from('space_expenses').insert({
    business_space_id: space.id,
    spent_on: spentOn,
    concept,
    amount,
  })
  if (error) throw error
}

const supplierNames = ['Polleria', 'Verdulería Norte', 'Carnicería del Parque', 'Panadería Luna']
const supplierByName = new Map()
for (const name of supplierNames) {
  let supplier = (await admin
    .from('suppliers')
    .select('id')
    .eq('business_space_id', space.id)
    .eq('name', name)
    .maybeSingle()).data
  if (!supplier) {
    const { data, error } = await admin.from('suppliers').insert({
      business_space_id: space.id,
      name,
      active: true,
    }).select('id').single()
    if (error) throw error
    supplier = data
  }
  supplierByName.set(name, supplier.id)
}

const supplierPayments = [
  ['Verdulería Norte', '2026-10-02', 'Verdura de la semana', 85000, 'EFECTIVO', 'PAGADO', null, null],
  ['Carnicería del Parque', '2026-10-03', 'Carne', 95000, 'ECHEQ', 'PENDIENTE', 'SEED-ECH-1013', '2026-10-13'],
  ['Panadería Luna', '2026-10-08', 'Pan de la semana', 40000, 'ECHEQ', 'PAGADO', 'SEED-ECH-1008', '2026-10-08'],
  ['Carnicería del Parque', '2026-10-08', 'Pollo y carne', 120000, 'TRANSFERENCIA', 'PAGADO', null, null],
  ['Verdulería Norte', '2026-10-15', 'Verdura', 78000, 'ECHEQ', 'PENDIENTE', 'SEED-ECH-1016', '2026-10-16'],
  ['Panadería Luna', '2026-10-20', 'Pan dulce y francés', 36000, 'EFECTIVO', 'PENDIENTE', null, null],
  ['Verdulería Norte', '2026-10-22', 'Verdura de la semana', 81000, 'TRANSFERENCIA', 'PAGADO', null, null],
  ['Carnicería del Parque', '2026-10-29', 'Carne', 110000, 'TRANSFERENCIA', 'PENDIENTE', null, null],
]
for (const [name, paidOn, concept, amount, method, status, echeqNumber, echeqDate] of supplierPayments) {
  const supplierId = supplierByName.get(name)
  const { data: exists } = await admin
    .from('supplier_payments')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('paid_on', paidOn)
    .eq('concept', concept)
    .maybeSingle()
  if (exists) continue
  const { error } = await admin.from('supplier_payments').insert({
    supplier_id: supplierId,
    business_space_id: space.id,
    paid_on: paidOn,
    concept,
    amount,
    method,
    status,
    echeq_number: echeqNumber,
    echeq_date: echeqDate,
  })
  if (error) throw error
}

const fixedPlan = [
  ['Alquiler', 0, 450000],
  ['IIBB', 1, 85000],
  ['Contador', 2, 120000],
  ['Internet', 3, 25000],
  ['Luz', 4, 60000],
]
for (const [name, sortOrder] of fixedPlan) {
  const { data: exists } = await admin
    .from('fixed_expenses')
    .select('id')
    .eq('business_space_id', space.id)
    .eq('name', name)
    .maybeSingle()
  if (exists) continue
  const { error } = await admin.from('fixed_expenses').insert({
    business_space_id: space.id,
    name,
    sort_order: sortOrder,
    active: true,
  })
  if (error) throw error
}

const { data: fixedExpenses, error: fixedError } = await admin
  .from('fixed_expenses')
  .select('id, name')
  .eq('business_space_id', space.id)
if (fixedError) throw fixedError
const fixedByName = new Map((fixedExpenses ?? []).map((expense) => [expense.name, expense.id]))

for (const [name, , amount] of fixedPlan) {
  const expenseId = fixedByName.get(name)
  for (let month = 1; month <= 10; month += 1) {
    const { data: exists } = await admin
      .from('fixed_expense_months')
      .select('id')
      .eq('fixed_expense_id', expenseId)
      .eq('year', 2026)
      .eq('month', month)
      .maybeSingle()
    if (exists) continue
    let status = 'PAGADO'
    let paidAmount = amount
    if (month === 10 && name === 'IIBB') {
      status = 'NO_APLICA'
      paidAmount = null
    } else if (month === 10 && name !== 'Internet') {
      continue
    }
    const { error } = await admin.from('fixed_expense_months').insert({
      fixed_expense_id: expenseId,
      business_space_id: space.id,
      year: 2026,
      month,
      status,
      amount: paidAmount,
    })
    if (error) throw error
  }
}

console.log(`Octubre 2026 listo. Elecciones nuevas: ${created}.`)
console.log('Semanas publicadas del 28 de septiembre al 30 de octubre.')
console.log('Diego López y Diego Castro quedan sin elegir, para ver “No eligió”.')
console.log('Ledesma tiene cargos sueltos de ingreso. Horizonte solo factura bandejas.')

async function ensurePrice(table, companyId, effectiveFrom, unitPrice) {
  const { data: exists, error: readError } = await admin
    .from(table)
    .select('id')
    .eq('company_id', companyId)
    .eq('effective_from', effectiveFrom)
    .maybeSingle()
  if (readError) throw readError
  if (exists) return
  const { error } = await admin.from(table).insert({
    company_id: companyId,
    business_space_id: space.id,
    unit_price: unitPrice,
    effective_from: effectiveFrom,
  })
  if (error) throw error
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function weekday(isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return (date.getUTCDay() + 6) % 7
}

function sqlUuid(value) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error('Identificador inválido')
  return `'${value}'::uuid`
}
