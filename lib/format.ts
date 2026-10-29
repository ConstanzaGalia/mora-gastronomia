import type { Enums } from '@/lib/database.types'

export type AppRole = Enums<'app_role'>

export const ROLE_LABEL: Record<AppRole, string> = {
  ORG_ADMIN: 'Administrador Mora',
  SPACE_ADMIN: 'Administrador',
  COMPANY_ADMIN: 'Encargado',
  EMPLOYEE: 'Empleado',
}

const ROLE_RANK: AppRole[] = ['ORG_ADMIN', 'SPACE_ADMIN', 'COMPANY_ADMIN', 'EMPLOYEE']

export function pickPrimaryRole<T extends { role: AppRole }>(roles: T[]) {
  return [...roles].sort((a, b) => ROLE_RANK.indexOf(a.role) - ROLE_RANK.indexOf(b.role))[0] ?? null
}

export function homePath(role: AppRole) {
  return role === 'EMPLOYEE' ? '/mi-menu' : '/inicio'
}

export function digits(value: string) {
  return value.replace(/\D/g, '')
}

export function employeeAuthEmail(dni: string) {
  return `${dni}@empleados.mora`
}

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function businessToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Tucuman',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Hasta las 12:00 (Tucumán) muestra el día de hoy; después, el de mañana. */
export function dashboardFocusDate(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Tucuman',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Tucuman',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now).find((part) => part.type === 'hour')?.value ?? '0',
  )
  return hour < 12 ? today : addDays(today, 1)
}

export function dashboardFocusLabel(focusDate = dashboardFocusDate(), today = businessToday()) {
  return focusDate === today ? 'hoy' : 'mañana'
}

export function daysBetween(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.slice(0, 10).split('-').map(Number)
  const [toYear, toMonth, toDay] = to.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86400000)
}

export function dueLabel(today: string, due: string) {
  const days = daysBetween(today, due)
  if (days < 0) return 'Vencido'
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  return `Vence en ${days} días`
}

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function mondayOf(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const isoDow = date.getUTCDay() || 7
  return addDays(isoDate.slice(0, 10), 1 - isoDow)
}

export function upcomingMonday(from = businessToday()) {
  const [year, month, day] = from.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const isoDow = date.getUTCDay() || 7
  const delta = isoDow === 1 ? 7 : 8 - isoDow
  return addDays(from, delta)
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)
}

export function formatHours(value: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)
}

export function moneyInput(value: number) {
  return value.toFixed(2).replace('.', ',')
}

export function parseAmount(raw: string) {
  const text = raw.trim().replace(/\s/g, '')
  if (!text) return null
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Number(normalized)
}

export function currentMonth(from = businessToday()) {
  return from.slice(0, 7)
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

export function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return {
    start: `${month}-01`,
    end: `${month}-${String(last).padStart(2, '0')}`,
  }
}

export function formatMonthName(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1, 1, 15))
  return new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(date)
}

export function formatMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1, 1, 15))
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function formatDay(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 15))
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Argentina/Tucuman',
  }).format(date)
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Tucuman',
  }).format(new Date(iso))
}

export function formatLongDate(isoDate = businessToday()) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 15))
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Tucuman',
  }).format(date)
}

const ERRORS: Record<string, string> = {
  ALREADY_CHOSEN: 'Esa persona ya eligió. No se puede reemplazar.',
  SELECTION_LOCKED: 'La elección ya está cerrada y no puede modificarse.',
  SELECTION_WINDOW_CLOSED: 'El plazo para elegir ya cerró.',
  SELECTION_CANCELLED: 'La elección está anulada.',
  SELECTION_NOT_FOUND: 'No encontramos esa elección.',
  PROFILE_NOT_FOUND: 'No existe una persona con ese DNI. Completá nombre y apellido para darla de alta.',
  PROFILE_INACTIVE: 'Esa persona está inactiva.',
  PROFILE_DATA_REQUIRED: 'Faltan DNI, nombre o apellido.',
  DNI_ALREADY_REGISTERED: 'Ese DNI ya tiene una cuenta.',
  COMPANY_INACTIVE: 'La empresa está inactiva.',
  COMPANY_NOT_AVAILABLE: 'La empresa no está disponible en ese espacio.',
  WEEK_WITHOUT_MENU: 'No se puede publicar una semana sin opciones en un día de servicio.',
  WEEK_HAS_SELECTIONS: 'No se puede despublicar una semana que ya tiene elecciones.',
  WEEK_HAS_DAYS: 'La semana ya tiene días cargados.',
  WEEK_NOT_PUBLISHED: 'La semana todavía no está publicada.',
  OPTION_HAS_SELECTIONS: 'Hay empleados que ya eligieron esta opción para ese día.',
  OPTION_NOT_AVAILABLE: 'La opción no está disponible para ese día.',
  OPTION_INACTIVE: 'La opción o la categoría está inactiva.',
  OPTION_CATEGORY_MISMATCH: 'La opción no pertenece a esa categoría.',
  CATEGORY_NOT_ENABLED: 'La categoría no está habilitada para la empresa.',
  NO_ACTIVE_MEMBERSHIP: 'No hay una relación laboral vigente para esa fecha.',
  COMPANY_REQUIRED: 'Elegí para qué empresa es el pedido.',
  SELECTION_COMPANY_LOCKED: 'Ya pediste ese día para otra empresa. Anulá la elección para pedir en la otra.',
  EMPTY_SELECTION: 'Elegí al menos una opción, o anulá la elección.',
  MEMBERSHIP_CONFLICT: 'Hay otra relación laboral que se superpone con esa fecha.',
  MEMBERSHIP_NOT_FOUND: 'No encontramos esa relación laboral.',
  FORBIDDEN: 'No tenés permiso para hacer esto.',
  NOT_AUTHENTICATED: 'Tenés que iniciar sesión.',
  INVALID_ROLE: 'Ese rol no se puede asignar desde acá.',
  DAY_HAS_SELECTIONS: 'Ese día ya tiene elecciones y no se puede cambiar.',
  DATE_OUTSIDE_WEEK: 'La fecha queda fuera de la semana.',
  NOT_A_SERVICE_DAY: 'Ese día no tiene servicio.',
  CALENDAR_DAY_NOT_FOUND: 'No encontramos ese día de servicio.',
  IMMUTABLE_FIELDS: 'Esos datos no se pueden modificar.',
  SPACE_INACTIVE: 'El espacio está inactivo.',
  SECTOR_COMPANY_MISMATCH: 'Ese sector no pertenece a esta empresa.',
}

export function describeError(error: { message?: string; details?: string | null; code?: string } | null) {
  if (!error) return 'No se pudo completar la operación.'
  if (error.code === '23503') return 'No se puede eliminar porque tiene datos asociados.'
  if (error.code === '23505') return 'Ya existe otro registro con ese nombre.'
  const detail = error.details?.trim()
  if (detail) return detail
  const message = error.message?.trim() ?? ''
  return ERRORS[message] ?? (message || 'No se pudo completar la operación.')
}
