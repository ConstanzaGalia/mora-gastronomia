import { addDays } from '@/lib/format'

export type TrayDay = { company_id: string; service_date: string; trays: number }
export type PricePoint = { id?: string; company_id: string; effective_from: string; unit_price: number }
export type PaymentRow = { company_id: string; paid_on: string; amount: number }

export type CompanyBill = {
  trays: number
  billed: number
  missingPrice: boolean
  unitPrice: number | null
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

export function pricesTouching(prices: PricePoint[], companyId: string, start: string, end: string) {
  const mine = prices
    .filter((price) => price.company_id === companyId)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  return mine.filter((price, index) => {
    const next = mine[index + 1]
    const until = next ? addDays(next.effective_from, -1) : '9999-12-31'
    return price.effective_from <= end && until >= start
  })
}

export function priceOn(prices: PricePoint[], companyId: string, date: string) {
  let best: PricePoint | null = null
  for (const price of prices) {
    if (price.company_id !== companyId || price.effective_from > date) continue
    if (!best || price.effective_from > best.effective_from) best = price
  }
  return best
}

export function billCompany(companyId: string, trays: TrayDay[], prices: PricePoint[], from: string, to: string): CompanyBill {
  let count = 0
  let amount = 0
  let missing = false
  for (const day of trays) {
    if (day.company_id !== companyId || day.service_date < from || day.service_date > to) continue
    count += day.trays
    const price = priceOn(prices, companyId, day.service_date)
    if (!price) missing = true
    else amount += day.trays * Number(price.unit_price)
  }
  const endPrice = priceOn(prices, companyId, to)
  return {
    trays: count,
    billed: money(amount),
    missingPrice: missing,
    unitPrice: endPrice ? Number(endPrice.unit_price) : null,
  }
}

export function sumPayments(payments: PaymentRow[], companyId: string | null, from: string, to: string) {
  const total = payments.reduce((sum, payment) => {
    if (companyId && payment.company_id !== companyId) return sum
    if (payment.paid_on < from || payment.paid_on > to) return sum
    return sum + Number(payment.amount)
  }, 0)
  return money(total)
}

export type HourEntry = { company_id: string; worked_on: string; hours: number }

export type HourBill = {
  hours: number
  billed: number
  missingPrice: boolean
  unitPrice: number | null
}

export function billHours(companyId: string, entries: HourEntry[], prices: PricePoint[], from: string, to: string): HourBill {
  let hours = 0
  let amount = 0
  let missing = false
  for (const entry of entries) {
    if (entry.company_id !== companyId || entry.worked_on < from || entry.worked_on > to) continue
    hours += entry.hours
    const price = priceOn(prices, companyId, entry.worked_on)
    if (!price) missing = true
    else amount += entry.hours * Number(price.unit_price)
  }
  const endPrice = priceOn(prices, companyId, to)
  return {
    hours: money(hours),
    billed: money(amount),
    missingPrice: missing,
    unitPrice: endPrice ? Number(endPrice.unit_price) : null,
  }
}

export function sumPaidSuppliers(rows: { paid_on: string; amount: number; status: string }[], from: string, to: string) {
  const total = rows.reduce((sum, row) => {
    if (row.status !== 'PAGADO' || row.paid_on < from || row.paid_on > to) return sum
    return sum + Number(row.amount)
  }, 0)
  return money(total)
}

export function sumPaidFixed(rows: { year: number; month: number; status: string; amount: number | null }[], from: string, to: string) {
  const startMonth = from.slice(0, 7)
  const endMonth = to.slice(0, 7)
  const total = rows.reduce((sum, row) => {
    if (row.status !== 'PAGADO' || row.amount == null) return sum
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`
    if (key < startMonth || key > endMonth) return sum
    return sum + Number(row.amount)
  }, 0)
  return money(total)
}

export type BalanceSection = 'empresas' | 'gastos' | 'proveedores' | 'echeqs' | 'fijos'

export type BalanceQuery = {
  vista: 'mes' | 'anio'
  month: string
  year: string
  seccion?: BalanceSection
  empresa?: string
}

export function balanceHref(query: BalanceQuery) {
  const params = new URLSearchParams()
  if (query.vista === 'anio') params.set('vista', 'anio')
  params.set('mes', query.month)
  params.set('anio', query.year)
  if (query.seccion && query.seccion !== 'empresas') params.set('seccion', query.seccion)
  if (query.empresa) params.set('empresa', query.empresa)
  return `/balance?${params}`
}

export function balanceFields(query: BalanceQuery) {
  const fields: Record<string, string> = {
    vista: query.vista,
    mes: query.month,
    anio: query.year,
  }
  if (query.seccion && query.seccion !== 'empresas') fields.seccion = query.seccion
  if (query.empresa) fields.empresa = query.empresa
  return fields
}
