import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { monthRange, type MealShift } from '@/lib/format'

type Client = SupabaseClient<Database>

export type MonthlyTrayDay = {
  serviceDate: string
  mealShift: MealShift | null
}

export type MonthlyTrayEmployee = {
  id: string
  apellido: string
  nombre: string
  dni: string
  sector: string
  total: number
  morning: number
  afternoon: number
  days: MonthlyTrayDay[]
}

export type MonthlyTrayReport = {
  companyName: string
  mealShiftsEnabled: boolean
  employees: MonthlyTrayEmployee[]
  total: number
  morningTotal: number
  afternoonTotal: number
}

function shortDay(isoDate: string) {
  const [, month, day] = isoDate.slice(0, 10).split('-')
  return `${Number(day)}/${Number(month)}`
}

function shiftWord(shift: MealShift | null) {
  if (shift === 'MORNING') return 'mañana'
  if (shift === 'AFTERNOON') return 'tarde'
  return ''
}

export function formatTrayDayLabel(day: MonthlyTrayDay, withShift: boolean) {
  const base = shortDay(day.serviceDate)
  if (!withShift) return base
  const shift = shiftWord(day.mealShift)
  return shift ? `${base} ${shift}` : base
}

export function formatTrayDaysList(days: MonthlyTrayDay[], withShift: boolean) {
  return days.map((day) => formatTrayDayLabel(day, withShift)).join(', ')
}

export type TrayMonthCell =
  | { kind: 'pad'; key: string }
  | { kind: 'day'; key: string; day: number; ordered: boolean; mealShift: MealShift | null }

/** Celdas Lun→Dom del mes para el mini calendario del informe. */
export function buildTrayMonthCells(month: string, days: MonthlyTrayDay[]): TrayMonthCell[] {
  const { end } = monthRange(month)
  const lastDay = Number(end.slice(8, 10))
  const [year, monthNumber] = month.split('-').map(Number)
  // Lunes = 0 … Domingo = 6
  const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1, 15)).getUTCDay() + 6) % 7
  const byDate = new Map(days.map((day) => [day.serviceDate, day]))
  const cells: TrayMonthCell[] = []
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ kind: 'pad', key: `pad-${index}` })
  }
  for (let day = 1; day <= lastDay; day += 1) {
    const iso = `${month}-${String(day).padStart(2, '0')}`
    const found = byDate.get(iso)
    cells.push({
      kind: 'day',
      key: iso,
      day,
      ordered: Boolean(found),
      mealShift: found?.mealShift ?? null,
    })
  }
  return cells
}

export async function loadMonthlyTrays(
  supabase: Client,
  spaceId: string,
  companyId: string,
  month: string,
): Promise<MonthlyTrayReport> {
  const { start, end } = monthRange(month)

  const [{ data: company }, { data: bandeja }] = await Promise.all([
    supabase
      .from('companies')
      .select('nombre_comercial, meal_shifts_enabled')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('gastronomic_categories')
      .select('id')
      .eq('business_space_id', spaceId)
      .eq('slug', 'bandeja')
      .maybeSingle(),
  ])

  const companyName = company?.nombre_comercial ?? 'Empresa'
  const mealShiftsEnabled = Boolean(company?.meal_shifts_enabled)

  if (!bandeja) {
    return {
      companyName,
      mealShiftsEnabled,
      employees: [],
      total: 0,
      morningTotal: 0,
      afternoonTotal: 0,
    }
  }

  const [{ data: details }, { data: members }, { data: sectors }] = await Promise.all([
    supabase
      .from('v_selection_details')
      .select('employee_id, service_date, meal_shift, nombre, apellido, dni')
      .eq('company_id', companyId)
      .eq('status', 'SUBMITTED')
      .eq('category_id', bandeja.id)
      .gte('service_date', start)
      .lte('service_date', end),
    supabase
      .from('memberships')
      .select('user_id, sector_id, started_at, ended_at')
      .eq('company_id', companyId)
      .in('role', ['EMPLOYEE', 'COMPANY_ADMIN'])
      .lte('started_at', end)
      .or(`ended_at.is.null,ended_at.gte.${start}`),
    supabase
      .from('company_sectors')
      .select('id, name')
      .eq('company_id', companyId),
  ])

  const sectorName = new Map((sectors ?? []).map((sector) => [sector.id, sector.name]))
  const sectorByUser = new Map<string, string>()
  for (const member of members ?? []) {
    if (sectorByUser.has(member.user_id)) continue
    sectorByUser.set(member.user_id, member.sector_id ? sectorName.get(member.sector_id) ?? 'Sin sector' : 'Sin sector')
  }

  const byEmployee = new Map<string, MonthlyTrayEmployee>()
  for (const row of details ?? []) {
    if (!row.employee_id || !row.service_date) continue
    const mealShift: MealShift | null =
      row.meal_shift === 'MORNING' || row.meal_shift === 'AFTERNOON' ? row.meal_shift : null
    const current = byEmployee.get(row.employee_id) ?? {
      id: row.employee_id,
      apellido: row.apellido ?? '',
      nombre: row.nombre ?? '',
      dni: row.dni ?? '',
      sector: sectorByUser.get(row.employee_id) ?? 'Sin sector',
      total: 0,
      morning: 0,
      afternoon: 0,
      days: [],
    }
    if (current.days.some((day) => day.serviceDate === row.service_date)) {
      byEmployee.set(row.employee_id, current)
      continue
    }
    current.days.push({ serviceDate: row.service_date, mealShift })
    current.total += 1
    if (mealShift === 'MORNING') current.morning += 1
    if (mealShift === 'AFTERNOON') current.afternoon += 1
    byEmployee.set(row.employee_id, current)
  }

  const employees = [...byEmployee.values()]
    .map((employee) => ({
      ...employee,
      days: [...employee.days].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)),
    }))
    .sort((a, b) => {
      const last = a.apellido.localeCompare(b.apellido, 'es')
      if (last !== 0) return last
      return a.nombre.localeCompare(b.nombre, 'es')
    })

  return {
    companyName,
    mealShiftsEnabled,
    employees,
    total: employees.reduce((sum, employee) => sum + employee.total, 0),
    morningTotal: employees.reduce((sum, employee) => sum + employee.morning, 0),
    afternoonTotal: employees.reduce((sum, employee) => sum + employee.afternoon, 0),
  }
}

export function monthlyTraysCsv(report: MonthlyTrayReport): string[][] {
  if (report.mealShiftsEnabled) {
    return [
      ['Empleado', 'DNI', 'Sector', 'Viandas', 'Mañana', 'Tarde', 'Fechas'],
      ...report.employees.map((employee) => [
        `${employee.apellido}, ${employee.nombre}`.replace(/^,\s*|\s*,\s*$/g, '').trim() || 'Sin nombre',
        employee.dni,
        employee.sector,
        String(employee.total),
        String(employee.morning),
        String(employee.afternoon),
        formatTrayDaysList(employee.days, true),
      ]),
      ['Total', '', '', String(report.total), String(report.morningTotal), String(report.afternoonTotal), ''],
    ]
  }
  return [
    ['Empleado', 'DNI', 'Sector', 'Viandas', 'Fechas'],
    ...report.employees.map((employee) => [
      `${employee.apellido}, ${employee.nombre}`.replace(/^,\s*|\s*,\s*$/g, '').trim() || 'Sin nombre',
      employee.dni,
      employee.sector,
      String(employee.total),
      formatTrayDaysList(employee.days, false),
    ]),
    ['Total', '', '', String(report.total), ''],
  ]
}
