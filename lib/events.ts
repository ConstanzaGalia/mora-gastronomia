import { currentMonth, monthRange } from '@/lib/format'
import type { Enums } from '@/lib/database.types'

export type EventStatus = Enums<'event_status'>
export type PaymentMethod = Enums<'payment_method'>
export type PaymentTone = 'muted' | 'gold' | 'success'

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  BORRADOR: 'Presupuesto',
  CONFIRMADO: 'Confirmado',
  REALIZADO: 'Realizado',
  CANCELADO: 'Cancelado',
}

export const EVENT_STATUS_TONE: Record<EventStatus, string> = {
  BORRADOR: 'draft',
  CONFIRMADO: 'success',
  REALIZADO: 'success',
  CANCELADO: 'muted',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  ECHEQ: 'eCheq',
}

export type PaymentState = 'pendiente' | 'parcial' | 'cobrado'

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  pendiente: 'Sin cobrar',
  parcial: 'Pago parcial',
  cobrado: 'Cobrado',
}

export const PAYMENT_STATE_TONE: Record<PaymentState, PaymentTone> = {
  pendiente: 'muted',
  parcial: 'gold',
  cobrado: 'success',
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function paymentState(quoted: number, collected: number): PaymentState {
  if (collected <= 0) return 'pendiente'
  if (collected + 0.005 < quoted) return 'parcial'
  return 'cobrado'
}

export function eventMoney(quoted: number, collected: number, expenses: number) {
  return {
    quoted: roundMoney(quoted),
    collected: roundMoney(collected),
    pending: roundMoney(Math.max(0, quoted - collected)),
    expenses: roundMoney(expenses),
    balance: roundMoney(collected - expenses),
    payment: paymentState(quoted, collected),
  }
}

export function sumMoney(rows: { money: ReturnType<typeof eventMoney> }[]) {
  return rows.reduce((sum, row) => ({
    quoted: sum.quoted + row.money.quoted,
    collected: sum.collected + row.money.collected,
    pending: sum.pending + row.money.pending,
    expenses: sum.expenses + row.money.expenses,
    balance: sum.balance + row.money.balance,
  }), { quoted: 0, collected: 0, pending: 0, expenses: 0, balance: 0 })
}

// Un evento confirmado cuya fecha ya pasó se muestra como realizado, sin que haya que marcarlo a mano.
export function displayStatus(status: EventStatus, eventOn: string, today: string): EventStatus {
  return status === 'CONFIRMADO' && eventOn < today ? 'REALIZADO' : status
}

export function eventTimeInput(value: string | null) {
  return value ? value.slice(0, 5) : ''
}

export function formatEventTime(value: string | null) {
  return value ? value.slice(0, 5) : null
}

export function eventDateParts(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 15))
  const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'America/Argentina/Tucuman' }).format(date)
  const monthName = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'America/Argentina/Tucuman' }).format(date)
  return { day: String(day), weekday: weekday.replace(/\.$/, ''), month: monthName.replace(/\.$/, '') }
}

export function periodFromSearch(mes?: string, anio?: string, vista?: string) {
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : currentMonth()
  const year = anio && /^\d{4}$/.test(anio) ? anio : month.slice(0, 4)
  if (vista === 'anio') {
    return { vista: 'anio' as const, month, year, start: `${year}-01-01`, end: `${year}-12-31` }
  }
  return { vista: 'mes' as const, month, year, ...monthRange(month) }
}
